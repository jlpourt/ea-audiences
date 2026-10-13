"""BigQuery Data Warehouse Tools for 2K Courtside ADK Agents."""

import os
import logging
from typing import Dict, List, Any, Optional
from google.cloud import bigquery

logger = logging.getLogger("twok.courtside.tools.bq")


def query_telemetry_events(player_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Queries live time-series player telemetry events from BigQuery twok_marketing_intelligence."""
    project_id = os.getenv("GCP_PROJECT_ID", "jamie-bq-test")
    dataset_id = os.getenv("BQ_DATASET_ID", "twok_marketing_intelligence")

    client = bigquery.Client(project=project_id)
    safe_limit = max(1, min(int(limit), 200))

    where_clause = "WHERE player_id = @player_id" if player_id else ""
    query_params = [bigquery.ScalarQueryParameter("limit", "INT64", safe_limit)]
    if player_id:
        query_params.append(bigquery.ScalarQueryParameter("player_id", "STRING", player_id))

    query = f"""
    SELECT event_id, player_id, game_id, event_timestamp, event_type,
           consecutive_losses, tilt_index, triggered_offer_id
    FROM `{project_id}.{dataset_id}.telemetry_events`
    {where_clause}
    ORDER BY event_timestamp DESC
    LIMIT @limit
    """
    job_config = bigquery.QueryJobConfig(query_parameters=query_params)
    query_job = client.query(query, job_config=job_config)
    return [dict(row) for row in query_job]

