# Read and update persisted application settings.

from fastapi import APIRouter
from pydantic import BaseModel

from src.database import get_connection

router = APIRouter()
DEFAULTS = {"theme": "dark", "appName": "DocBuddy"}


@router.get("/api/settings")
def get_settings():
    # Return saved settings combined with their application defaults.
    with get_connection() as db:
        values = {row["key"]: row["value"] for row in db.execute("SELECT key,value FROM app_settings")}
    return {**DEFAULTS, **values}


class SettingInput(BaseModel):
    value: str


@router.put("/api/settings/{key}")
def set_setting(key: str, payload: SettingInput):
    # Save a supported application setting.
    if key not in DEFAULTS:
        return {"ok": False}
    with get_connection() as db:
        db.execute("INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                   (key, payload.value))
    return {"ok": True}
