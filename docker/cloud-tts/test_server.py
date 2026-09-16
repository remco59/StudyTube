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
        self.request = server.CloudSynthesisRequest(
            text="Test narration",
            language="nl-NL",
            voice="nl-NL-Chirp3-HD-Charon",
        )

    def tearDown(self):
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


if __name__ == "__main__":
    unittest.main()
