from tests.conftest import API, PASSWORD, auth_headers


def test_update_profile_and_prefs_merge(client, student):
    r = client.patch(f"{API}/users/me", headers=student["headers"],
                     json={"full_name": "  New Name ", "theme_preference": "dark",
                           "chat_preferences": {"show_sources": False}})
    assert r.status_code == 200
    body = r.json()
    assert body["full_name"] == "New Name" and body["theme_preference"] == "dark"
    assert body["chat_preferences"] == {"show_sources": False}
    r2 = client.patch(f"{API}/users/me", headers=student["headers"], json={"chat_preferences": {"compact_mode": True}})
    assert r2.json()["chat_preferences"] == {"show_sources": False, "compact_mode": True}


def test_invalid_theme_and_unknown_fields_rejected(client, student):
    assert client.patch(f"{API}/users/me", headers=student["headers"], json={"theme_preference": "neon"}).status_code == 422
    assert client.patch(f"{API}/users/me", headers=student["headers"], json={"role": "admin"}).status_code == 422
    assert client.patch(f"{API}/users/me", headers=student["headers"],
                        json={"chat_preferences": {"bogus": 1}}).status_code == 422


def test_change_password_flow_invalidates_old_tokens(client, student):
    r = client.post(f"{API}/users/me/change-password", headers=student["headers"],
                    json={"current_password": PASSWORD, "new_password": "BrandNewPass9"})
    assert r.status_code == 200
    new_token = r.json()["access_token"]
    # old token no longer works, new one does
    assert client.get(f"{API}/auth/me", headers=student["headers"]).status_code == 401
    assert client.get(f"{API}/auth/me", headers=auth_headers(new_token)).status_code == 200
    # old password rejected, new accepted
    assert client.post(f"{API}/auth/login", json={"email": "student@example.com", "password": PASSWORD}).status_code == 401
    assert client.post(f"{API}/auth/login", json={"email": "student@example.com", "password": "BrandNewPass9"}).status_code == 200


def test_change_password_validation(client, student):
    wrong = client.post(f"{API}/users/me/change-password", headers=student["headers"],
                        json={"current_password": "Nope12345", "new_password": "BrandNewPass9"})
    assert wrong.status_code == 400
    same = client.post(f"{API}/users/me/change-password", headers=student["headers"],
                       json={"current_password": PASSWORD, "new_password": PASSWORD})
    assert same.status_code == 400
    weak = client.post(f"{API}/users/me/change-password", headers=student["headers"],
                       json={"current_password": PASSWORD, "new_password": "short"})
    assert weak.status_code == 422
