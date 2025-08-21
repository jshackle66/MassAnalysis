from langchain_aws.llms import BedrockLLM
from langchain_aws import ChatBedrock
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

def analyze_transcription(
    transcription_data, 
    service: str = 'bedrock',
    model: str = None
):
    full_text = ""
    for segment in transcription_data["chunks"]:
        full_text += str(segment.get("timestamp", "")) + " " + segment.get("text", "") + " "

    with open("mass_keywords.json", "r") as f:
        mass_keywords = json.load(f)

    system_prompt = f"""You are an AI assistant specialized in analyzing transcripts of Catholic Masses. Your task is to identify the following parts of the Mass from the provided transcript: the beginning of the Mass, the Gloria, the first reading, the Gospel, the homily, the prayers of the faithful, the start of the Eucharistic prayer, distribution of communion, and the end of Mass. For each identified part, provide the approximate start time based on the transcript segments. If a part is not clearly identifiable, do not include it in your output. Please provide the output in a structured JSON format.

Note: The transcript often mistakes periods of silence for the phrase "Thank you". Please ignore instances of "Thank you" in the transcript when analyzing the parts of the Mass.

Here are some keywords that can help you identify the parts of the Mass:
{"{" + json.dumps(mass_keywords, indent=2) + "}"}"""

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "The transcript is as follows:\n{transcript}")
    ])

    if service == 'bedrock':
        model_id = model or "anthropic.claude-3-sonnet-20240229-v1:0"
        llm = ChatBedrock(model_id=model_id)
    elif service == 'ollama':
        model_id = model or "gemma3:12b"
        llm = ChatOllama(model=model_id, format="json")
    else:
        raise ValueError(f"Unsupported service: {service}")

    chain = prompt | llm


    retries = 0
    max_retries = 7
    while retries < max_retries:
        try:
            llm_output = chain.invoke({"transcript": full_text.strip()})
            break
        except Exception as e:
            if "throttling" in str(e).lower() and retries < max_retries - 1:
                retries += 1
                print(f"Throttled {retries} times. Retrying in {2 ** retries} seconds...")
                time.sleep(2 ** retries)  # Exponential backoff
                continue
            raise Exception("Max retries exceeded")
    # Extract JSON from the LLM's output
    json_match = re.search(r"\{.*\}", llm_output.content, re.DOTALL)
    if json_match:
        json_string = json_match.group(0)
    else:
        # If no code block, try to parse the whole output as JSON
        json_string = llm_output

    try:
        detected_parts = json.loads(json_string)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        print(f"Attempted to decode: {json_string}")
        raise e

    return detected_parts