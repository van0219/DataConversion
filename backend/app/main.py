from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.core.config import settings

# Import routers
from app.modules.accounts.router import router as accounts_router
from app.modules.schema.router import router as schema_router
from app.modules.snapshot.router import router as snapshot_router
from app.modules.upload.router import router as upload_router
from app.modules.mapping.router import router as mapping_router
from app.modules.validation.router import router as validation_router
from app.modules.load.router import router as load_router
from app.modules.rules.router import router as rules_router
from app.modules.workflows.router import router as workflows_router

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FSM Conversion Workbench",
    description="Local-first enterprise FSM data conversion platform",
    version="1.0.0"
)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(accounts_router, prefix="/api/accounts", tags=["accounts"])
app.include_router(schema_router, prefix="/api/schema", tags=["schema"])
app.include_router(snapshot_router, prefix="/api/snapshot", tags=["snapshot"])
app.include_router(upload_router, prefix="/api/upload", tags=["upload"])
app.include_router(mapping_router, prefix="/api/mapping", tags=["mapping"])
app.include_router(validation_router, prefix="/api/validation", tags=["validation"])
app.include_router(load_router, prefix="/api/load", tags=["load"])
app.include_router(rules_router, prefix="/api/rules", tags=["rules"])
app.include_router(workflows_router, prefix="/api/workflows", tags=["workflows"])

@app.get("/")
async def root():
    return {"message": "FSM Conversion Workbench API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
