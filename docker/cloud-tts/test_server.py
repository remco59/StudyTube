import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from google.api_core.exceptions import Unauthenticated

import server


class FakeCredentials:
    def __init__(self):
        self.refresh_calls = 0

    def refresh(self, request):
        self.refresh_calls += 1


class GoogleChirpTokenRefreshTests(unittest.TestCase):
    def setUp(self):
        server.reset_google_client()
        self.temp_dir = tempfile.TemporaryDirectory()
        self.credentials_path = Path(self.temp_dir.name) / "google.json"
        self.credentials_path.write_text("{}", encoding="utf-8")
        self.usage_path_patcher = patch.object(server, "GOOGLE_CHIRP_USAGE_PATH", Path(self.temp_dir.name) / "usage.json")
        self.usage_path_patcher.start()
        self.request = server.CloudSynthesisRequest(
            text="Test narration",
            language="nl-NL",
            voice="nl-NL-Chirp3-HD-Charon",
        )

    def tearDown(self):
        self.usage_path_patcher.stop()
        server.reset_google_client()
        self.temp_dir.cleanup()

    def _run_with_clients(self, clients):
        credentials = FakeCredentials()
        with (
            patch.object(server, "google_credentials_path", return_value=self.credentials_path),
            patch.object(server, "load_credentials_from_file", return_value=(credentials, "test-project")) as load_credentials,
            patch.object(server.texttospeech, "TextToSpeechClient", side_effect=clients) as client_factory,
        ):
            response = server.google_synthesize(self.request)
        return response, credentials, load_credentials, client_factory

    def test_retries_once_after_unauthenticated_and_forces_refresh(self):
        expired_client = MagicMock()
        expired_client.synthesize_speech.side_effect = Unauthenticated("ACCESS_TOKEN_EXPIRED")
        refreshed_client = MagicMock()
        refreshed_client.synthesize_speech.return_value = SimpleNamespace(audio_content=b"refreshed-audio")

        response, credentials, load_credentials, client_factory = self._run_with_clients([expired_client, refreshed_client])

        self.assertEqual(response.body, b"refreshed-audio")
        self.assertEqual(credentials.refresh_calls, 1)
        self.assertEqual(load_credentials.call_count, 2)
        self.assertEqual(client_factory.call_count, 2)
        expired_client.synthesize_speech.assert_called_once()
        refreshed_client.synthesize_speech.assert_called_once()

    def test_retries_when_expired_token_marker_is_wrapped_in_generic_exception(self):
        expired_client = MagicMock()
        expired_client.synthesize_speech.side_effect = RuntimeError("Google error: ACCESS_TOKEN_EXPIRED")
        refreshed_client = MagicMock()
        refreshed_client.synthesize_speech.return_value = SimpleNamespace(audio_content=b"ok")

        response, credentials, _, client_factory = self._run_with_clients([expired_client, refreshed_client])

        self.assertEqual(response.body, b"ok")
        self.assertEqual(credentials.refresh_calls, 1)
        self.assertEqual(client_factory.call_count, 2)

    def test_does_not_retry_non_authentication_errors(self):
        failed_client = MagicMock()
        failed_client.synthesize_speech.side_effect = RuntimeError("quota exhausted")

        credentials = FakeCredentials()
        with (
            patch.object(server, "google_credentials_path", return_value=self.credentials_path),
            patch.object(server, "load_credentials_from_file", return_value=(credentials, "test-project")),
            patch.object(server.texttospeech, "TextToSpeechClient", return_value=failed_client) as client_factory,
        ):
            with self.assertRaises(HTTPException) as raised:
                server.google_synthesize(self.request)

        self.assertEqual(raised.exception.status_code, 502)
        self.assertIn("quota exhausted", raised.exception.detail)
        self.assertEqual(credentials.refresh_calls, 0)
        self.assertEqual(client_factory.call_count, 1)
        self.assertEqual(server.google_usage_snapshot()["usedCharacters"], 0)


class GoogleChirpUsageTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.usage_path_patcher = patch.object(server, "GOOGLE_CHIRP_USAGE_PATH", Path(self.temp_dir.name) / "usage.json")
        self.usage_path_patcher.start()
        self.limit_patcher = patch.object(server, "GOOGLE_CHIRP_MONTHLY_FREE_CHARACTERS", 20)
        self.limit_patcher.start()

    def tearDown(self):
        self.limit_patcher.stop()
        self.usage_path_patcher.stop()
        self.temp_dir.cleanup()

    def _request(self, text):
        return server.CloudSynthesisRequest(
            text=text,
            language="nl-NL",
            voice="nl-NL-Chirp3-HD-Charon",
        )

    def test_successful_synthesis_counts_characters(self):
        client = MagicMock()
        client.synthesize_speech.return_value = SimpleNamespace(audio_content=b"audio")

        with patch.object(server, "get_google_client", return_value=client):
            response = server.google_synthesize(self._request("12345678"))

        usage = server.google_usage_snapshot()
        self.assertEqual(response.body, b"audio")
        self.assertEqual(usage["usedCharacters"], 8)
        self.assertEqual(usage["remainingCharacters"], 12)
        self.assertFalse(usage["exhausted"])

    def test_failed_synthesis_rolls_back_reserved_characters(self):
        client = MagicMock()
        client.synthesize_speech.side_effect = RuntimeError("provider failure")

        with patch.object(server, "get_google_client", return_value=client):
            with self.assertRaises(HTTPException):
                server.google_synthesize(self._request("12345678"))

        usage = server.google_usage_snapshot()
        self.assertEqual(usage["usedCharacters"], 0)
        self.assertEqual(usage["remainingCharacters"], 20)

    def test_blocks_request_that_would_cross_free_limit(self):
        client = MagicMock()
        client.synthesize_speech.return_value = SimpleNamespace(audio_content=b"audio")

        with patch.object(server, "get_google_client", return_value=client):
            server.google_synthesize(self._request("123456789012345678"))
            with self.assertRaises(HTTPException) as raised:
                server.google_synthesize(self._request("abc"))

        usage = server.google_usage_snapshot()
        self.assertEqual(raised.exception.status_code, 429)
        self.assertIn("only 2", raised.exception.detail)
        self.assertEqual(usage["usedCharacters"], 18)
        self.assertEqual(usage["remainingCharacters"], 2)
        self.assertEqual(client.synthesize_speech.call_count, 1)

    def test_marks_month_as_exhausted_at_exact_limit(self):
        client = MagicMock()
        client.synthesize_speech.return_value = SimpleNamespace(audio_content=b"audio")

        with patch.object(server, "get_google_client", return_value=client):
            server.google_synthesize(self._request("12345678901234567890"))

        usage = server.google_usage_snapshot()
        self.assertEqual(usage["usedCharacters"], 20)
        self.assertEqual(usage["remainingCharacters"], 0)
        self.assertTrue(usage["exhausted"])


if __name__ == "__main__":
    unittest.main()
