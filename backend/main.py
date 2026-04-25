from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent import (
    UserRequestParser,
    SourcingPipeline,
    MultimodalEliminationFilter,
    OutputGenerator,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

parser = UserRequestParser()
sourcing = SourcingPipeline()
filt = MultimodalEliminationFilter(parser)
output = OutputGenerator()


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/search")
def search(req: SearchRequest):
    attrs = parser.parse(req.query)
    listings = sourcing.fetch(
        category=attrs.category if attrs.category != "any" else None,
        max_price=attrs.budget_max,
    )
    ranked = filt.rank(listings, attrs)
    return output.to_api_json(ranked[: req.top_k])
