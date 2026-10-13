"""Spanner Graph GQL Tools for 2K Courtside ADK Agents."""

import os
import logging
from typing import Dict, List, Any, Optional
from google.cloud import spanner

logger = logging.getLogger("twok.courtside.tools.spanner")


def run_spanner_gql_query(gql: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Executes a live GQL query on Google Cloud Spanner TakeTwoPlayerGraph."""
    project_id = os.getenv("GCP_PROJECT_ID", "jamie-bq-test")
    instance_id = os.getenv("SPANNER_INSTANCE_ID", "blackrock-spanner")
    database_id = os.getenv("SPANNER_DATABASE_ID", "twok_graph_db")

    client = spanner.Client(project=project_id)
    instance = client.instance(instance_id)
    database = instance.database(database_id)

    with database.snapshot() as snapshot:
        results = snapshot.execute_sql(gql, params=params or {})
        rows = [dict(zip([col.name for col in results.fields], row)) for row in results]
        return rows

