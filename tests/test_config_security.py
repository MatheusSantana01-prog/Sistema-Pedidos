from backend.app.core.config import LOCAL_CORS_ORIGINS, parse_cors_origins


def test_cors_origin_parser_keeps_configured_domains_and_local_dev():
    origins = parse_cors_origins("https://frontend-teal-nine-80.vercel.app, https://demo.example.com")

    assert "https://frontend-teal-nine-80.vercel.app" in origins
    assert "https://demo.example.com" in origins
    for local_origin in LOCAL_CORS_ORIGINS:
        assert local_origin in origins


def test_cors_origin_parser_deduplicates_values():
    origins = parse_cors_origins("https://frontend-teal-nine-80.vercel.app,https://frontend-teal-nine-80.vercel.app")

    assert origins.count("https://frontend-teal-nine-80.vercel.app") == 1
