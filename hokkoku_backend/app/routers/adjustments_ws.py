from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from .. import store

router = APIRouter()

@router.websocket("/ws/adjustments")
async def ws_adjustments(websocket: WebSocket):
    await websocket.accept()
    q = store.subscribe_queue()
    try:
        await websocket.send_json({"type": "info", "message": "adjustments ws connected"})
        while True:
            msg = await q.get()
            await websocket.send_json(msg)
    except WebSocketDisconnect:
        store.unsubscribe_queue(q)
        return
    except Exception:
        store.unsubscribe_queue(q)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
