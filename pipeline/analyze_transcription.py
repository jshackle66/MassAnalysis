import json
import time
from langchain_aws import ChatBedrock
from langchain_ollama import ChatOllama
from langchain_core.prompts import PromptTemplate
from langchain.agents import AgentExecutor, create_react_agent
from langchain.tools import tool

def analyze_transcription(
    transcription_data, 
    service: str = 'bedrock',
    model: str = None
):
    """
    Analyzes a transcription of a Catholic Mass using an agent with tools to identify key parts.

    The agent gradually views the transcript and records the parts of the Mass it identifies.
    """
    chunks = transcription_data.get("chunks", [])
    if not chunks:
        return "", {}

    detected_parts = {}
    current_index = 0
    chunk_size = 5

    @tool
    def view_next_part() -> str:
        """
        Views a portion of the transcript from a start index to an end index.
        The transcript is a list of chunks. It is better to view in smaller chunks (e.g. 10-20 at a time).
        """
        nonlocal current_index
        end_index = min(current_index + chunk_size, len(chunks))
        start_index = current_index
        transcript_part = ""
        for i in range(start_index, end_index):
            segment = chunks[i]
            transcript_part += f'[{segment.get("timestamp", "")}] {segment.get("text", "")}\n'
        if end_index >= len(chunks):
            transcript_part += "End of transcript reached."
        current_index = end_index
        return transcript_part

    @tool
    def view_previous_part() -> str:
        """
        Views the previous portion of the transcript.
        """
        nonlocal current_index
        current_index = max(0, current_index - chunk_size)
        return view_next_part()

    @tool
    def record_mass_part(part_name: str, timestamp: str):
        """Records a part of the Mass with its timestamp. Overwrites if part_name already exists."""
        valid_parts = [
            "beginning_of_the_mass", "gloria", "first_reading", "gospel", "homily", 
            "prayers_of_the_faithful", "start_of_the_eucharistic_prayer", 
            "distribution_of_communion", "end_of_mass"
        ]
        if part_name not in valid_parts:
            return f"Error: Invalid part_name. Must be one of {valid_parts}"
        
        detected_parts[part_name] = timestamp
        return f"Success: Recorded {part_name} at {timestamp}."

    tools = [view_next_part, view_previous_part, record_mass_part]

    with open("mass_keywords.json", "r") as f:
        mass_keywords = json.load(f)

    template = f"""You are an AI assistant specialized in analyzing transcripts of Catholic Masses.

TOOLS:
{{tools}}

To use a tool, please use the following format:

```
Thought: Do I need to use a tool? Yes
Action: the action to take, should be one of [{{tool_names}}]
Action Input: the input to the action
Observation: the result of the action
```

Your task is to identify the following parts of the Mass from the provided transcript: the beginning of the Mass, the Gloria, the first reading, the Gospel, the homily, the prayers of the faithful, the start of the Eucharistic prayer, distribution of communion, and the end of Mass. For each identified part, provide the approximate start time based on the transcript segments.

Here are the valid `part_name` values for `record_mass_part`:
"beginning_of_the_mass", "gloria", "first_reading", "gospel", "homily", "prayers_of_the_faithful", "start_of_the_eucharistic_prayer", "distribution_of_communion", "end_of_mass"

Note: The transcript often mistakes periods of silence for the phrase "Thank you". Please ignore instances of "Thank you" in the transcript when analyzing the parts of the Mass.

Here are some keywords that can help you identify the parts of the Mass:
{{{json.dumps(mass_keywords, indent=2)}}}

Your workflow should be:
1. Use the `view_next_part` tool to navigate through the transcript chunk by chunk.
2. If you need to revisit a previous section, you can use the `view_previous_part` tool.
3. When you identify a part of the Mass, use `record_mass_part` with the correct `part_name` and the timestamp from the transcript. The timestamp is the first element in each line, e.g., `[('0.0', '2.5')]`.
4. Continue this process until you have analyzed the entire transcript. The `view_next_part` tool will indicate when you have reached the end.
5. Once you have viewed the whole transcript and recorded all identifiable parts, you are done. The final result is the accumulated JSON object of recorded parts.

Begin!

Input: {{input}}
Agent Scratchpad: {{agent_scratchpad}}
"""

    prompt = PromptTemplate.from_template(template)

    if service == 'bedrock':
        model_id = model or "anthropic.claude-3-sonnet-20240229-v1:0"
        llm = ChatBedrock(model_id=model_id, model_kwargs={ "temperature": 0.0 })
    elif service == 'ollama':
        model_id = model or "gemma3:12b"
        llm = ChatOllama(model=model_id, temperature=0.0)
    else:
        raise ValueError(f"Unsupported service: {service}")

    agent = create_react_agent(llm, tools, prompt)
    agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True, handle_parsing_errors=True)

    retries = 0
    max_retries = 7
    while retries < max_retries:
        try:
            agent_executor.invoke({"input": "Analyze the transcript to find the parts of the Mass."})
            break
        except Exception as e:
            if "throttling" in str(e).lower() and retries < max_retries - 1:
                retries += 1
                print(f"Throttled {retries} times. Retrying in {2 ** retries} seconds...")
                time.sleep(2 ** retries)
                continue
            print(f"An error occurred during agent execution: {e}")
            break 

    full_text = ""
    for segment in transcription_data["chunks"]:
        full_text += str(segment.get("timestamp", "")) + " " + segment.get("text", "") + " "

    return detected_parts