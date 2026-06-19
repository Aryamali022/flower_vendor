"""Authentication & authorization dependencies."""
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError

from .security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


@dataclass
class CurrentUser:
    id: str
    role: str
    name: str

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


def get_current_user(token: str = Depends(oauth2_scheme)) -> CurrentUser:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="અમાન્ય અથવા સમાપ્ત થયેલ સત્ર",  # invalid/expired session
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise cred_exc
        return CurrentUser(
            id=user_id,
            role=payload.get("role", "staff"),
            name=payload.get("name", ""),
        )
    except JWTError:
        raise cred_exc


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ફક્ત એડમિન માટે",  # admin only
        )
    return user
