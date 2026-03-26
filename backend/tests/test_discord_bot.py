from alma.gateway.models import UnifiedMessage


def test_discord_webhook_module():
    """Discord 봇 모듈 임포트 확인"""
    from alma.gateway.discord_bot import _send_discord, discord_webhook

    assert callable(discord_webhook)
    assert callable(_send_discord)


def test_unified_message_discord():
    msg = UnifiedMessage(
        channel="discord",
        user_id="user-1",
        content="hello",
        metadata={"channel_id": "123", "guild_id": "456"},
    )
    assert msg.channel == "discord"
    assert msg.metadata["channel_id"] == "123"
