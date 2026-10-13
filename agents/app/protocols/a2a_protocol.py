"""Official A2A (Agent2Agent) JSON-RPC 2.0 Protocol Implementation for 2K Courtside."""

import time
import uuid
import logging
from typing import Dict, List, Any, Optional, Callable

logger = logging.getLogger("twok.courtside.a2a")

# Official A2A Task Store (in-memory)
_TASK_STORE: Dict[str, Dict[str, Any]] = {}
_AGENT_HANDLERS: Dict[str, Callable[[Dict[str, Any]], Dict[str, Any]]] = {}

# Official AgentCard Definition
AGENT_CARD = {
  "name": "Courtside_AudienceAgent",
  "description": "2K Courtside — Audience Builder & Segmentation Engine for NBA 2K and Take-Two Interactive (Google Cloud Vertex AI & Spanner Graph)",
  "url": "http://127.0.0.1:3005/api/a2a",
  "version": "1.0.0",
  "protocol_version": "0.2.0",
  "provider": {
    "organization": "Take-Two Interactive / 2K Games / Google Cloud",
    "url": "https://cloud.google.com/spanner",
  },
  "capabilities": {
    "streaming": True,
    "push_notifications": True,
    "state_machine": "FSM_SUPPORTED",
  },
  "skills": [
    {
      "id": "query_spanner_graph",
      "name": "Query TakeTwoPlayerGraph",
      "description": "Translates natural language to Spanner GQL and queries Take-Two player graph with multi-hop crew and cross-label identity resolution.",
    },
    {
      "id": "simulate_focus_group",
      "name": "Courtside Focus Group Simulation",
      "description": "Pressure-tests 2K campaigns across representative NBA 2K personas grounded on live Reddit sentiment.",
    },
    {
      "id": "emit_audience_brief",
      "name": "Emit Campaign Brief",
      "description": "Synthesizes cohort telemetry and focus group consensus into a structured campaign brief for multimodal creative generation and channel activation.",
    },
  ],
}


def register_agent_handler(skill_or_agent_name: str, handler: Callable[[Dict[str, Any]], Dict[str, Any]]):
  """Register a skill or agent execution handler for incoming A2A tasks."""
  _AGENT_HANDLERS[skill_or_agent_name] = handler
  logger.info(f"Registered A2A handler for '{skill_or_agent_name}'")


def handle_a2a_jsonrpc_request(rpc_request: Dict[str, Any]) -> Dict[str, Any]:
  """Processes an incoming A2A JSON-RPC 2.0 request according to the official A2A specification."""
  req_id = rpc_request.get("id", str(uuid.uuid4()))
  method = rpc_request.get("method", "")
  params = rpc_request.get("params", {})

  if method in ("agents/getCard", "agent/getCard"):
    return {
      "jsonrpc": "2.0",
      "id": req_id,
      "result": AGENT_CARD,
    }

  if method in ("tasks/create", "tasks/send", "message/send"):
    task_id = params.get("task_id") or f"task-2k-{uuid.uuid4().hex[:8]}"
    sender = params.get("sender", "Courtside_AudienceAgent")
    recipient = params.get("recipient", "Courtside_ChannelAgent")
    payload = params.get("payload", {})

    handler = _AGENT_HANDLERS.get(recipient) or _AGENT_HANDLERS.get(params.get("intent", ""))

    execution_result = {}
    if handler:
      try:
        execution_result = handler(params)
      except Exception as e:
        logger.error(f"Error executing A2A handler for '{recipient}': {e}")
        execution_result = {"error": str(e)}

    task_record = {
      "task_id": task_id,
      "created_at": time.time(),
      "status": "COMPLETED",
      "sender": sender,
      "recipient": recipient,
      "intent": params.get("intent", method),
      "input": params,
      "output": execution_result,
    }
    _TASK_STORE[task_id] = task_record

    return {
      "jsonrpc": "2.0",
      "id": req_id,
      "result": {
        "task_id": task_id,
        "status": "COMPLETED",
        "output": execution_result,
      },
    }

  if method in ("tasks/get", "task/get"):
    task_id = params.get("task_id")
    if task_id in _TASK_STORE:
      return {
        "jsonrpc": "2.0",
        "id": req_id,
        "result": _TASK_STORE[task_id],
      }
    return {
      "jsonrpc": "2.0",
      "id": req_id,
      "error": {"code": -32602, "message": f"Task '{task_id}' not found."},
    }

  if method in ("tasks/list", "task/list"):
    return {
      "jsonrpc": "2.0",
      "id": req_id,
      "result": {"tasks": list(_TASK_STORE.values())},
    }

  return {
    "jsonrpc": "2.0",
    "id": req_id,
    "error": {"code": -32601, "message": f"Method '{method}' not found."},
  }


def create_a2a_message(
  sender: str,
  recipient: str,
  intent: str,
  payload: Dict[str, Any],
  correlation_id: Optional[str] = None,
) -> Dict[str, Any]:
  """Factory function for standardized A2A inter-agent envelopes."""
  return {
    "message_id": f"msg-2k-{uuid.uuid4().hex[:8]}",
    "correlation_id": correlation_id or f"corr-2k-{uuid.uuid4().hex[:8]}",
    "sender": sender,
    "recipient": recipient,
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "intent": intent,
    "payload": payload,
    "status": "DISPATCHED",
  }


_CONVERSATION_HISTORY: List[Dict[str, Any]] = []


def route_a2a_message(msg: Dict[str, Any]) -> Dict[str, Any]:
  """Simulates local in-process A2A message routing between agent microservices."""
  _CONVERSATION_HISTORY.append(msg)
  recipient = msg.get("recipient")

  handler = _AGENT_HANDLERS.get(recipient)
  if handler:
    try:
      response_payload = handler(msg)
      return {
        "status": "DELIVERED",
        "recipient": recipient,
        "response": response_payload,
      }
    except Exception as e:
      return {"status": "ERROR", "error": str(e)}

  return {
    "status": "QUEUED_FOR_REMOTE_AGENT",
    "recipient": recipient,
    "note": "Recipient registered on external A2A node",
  }


def get_conversation_history() -> List[Dict[str, Any]]:
  return _CONVERSATION_HISTORY


def get_all_active_traces() -> List[Dict[str, Any]]:
  return list(_TASK_STORE.values())
