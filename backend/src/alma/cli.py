"""ALMA CLI Client -- 터미널에서 ALMA와 대화"""

import argparse
import sys

import httpx

DEFAULT_BASE_URL = "http://localhost:8000"


def login(base_url: str, email: str, password: str) -> str:
    """로그인 -> JWT 토큰 반환"""
    response = httpx.post(
        f"{base_url}/api/auth/login",
        json={"email": email, "password": password},
        timeout=10.0,
    )
    if response.status_code != 200:
        print(f"로그인 실패: {response.text}")
        sys.exit(1)
    token = response.json()["access_token"]
    print(f"로그인 성공 ({email})")
    return token


def chat(
    base_url: str,
    token: str,
    content: str,
    conversation_id: str | None = None,
) -> tuple[str, str]:
    """메시지 전송 -> 응답 반환"""
    body: dict = {"content": content}
    if conversation_id:
        body["conversation_id"] = conversation_id
    response = httpx.post(
        f"{base_url}/api/chat/message",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
        timeout=60.0,
    )
    if response.status_code != 200:
        return f"오류: {response.text}", conversation_id or ""
    data = response.json()
    return data["response"], data["conversation_id"]


def main():
    parser = argparse.ArgumentParser(description="ALMA CLI Client")
    parser.add_argument("--url", default=DEFAULT_BASE_URL, help="Backend URL")
    parser.add_argument("--email", required=True, help="Email")
    parser.add_argument("--password", required=True, help="Password")
    args = parser.parse_args()

    token = login(args.url, args.email, args.password)
    conversation_id = None

    print("\nALMA와 대화를 시작합니다. (종료: quit, 새 대화: /new)")
    print("-" * 50)

    while True:
        try:
            user_input = input("\nYou: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n안녕히 가세요!")
            break

        if not user_input:
            continue
        if user_input.lower() in ("quit", "exit", "q"):
            print("안녕히 가세요!")
            break
        if user_input == "/new":
            conversation_id = None
            print("새 대화를 시작합니다.")
            continue

        response_text, conversation_id = chat(args.url, token, user_input, conversation_id)
        print(f"\nALMA: {response_text}")


if __name__ == "__main__":
    main()
