from pydantic import BaseModel, ConfigDict


class ProviderBase(BaseModel):
    name: str
    tax_id: str | None = None
    contact_info: str | None = None
    is_active: bool = True


class ProviderCreate(ProviderBase):
    pass


class ProviderOut(ProviderBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
