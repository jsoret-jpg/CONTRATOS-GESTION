from pydantic import BaseModel, ConfigDict


class CompanyBase(BaseModel):
    name: str
    code: str
    is_active: bool = True


class CompanyCreate(CompanyBase):
    pass


class CompanyOut(CompanyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
