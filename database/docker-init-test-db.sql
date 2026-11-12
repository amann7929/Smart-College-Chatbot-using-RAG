-- Used by docker-compose.yml: creates the separate TEST database used by pytest.
CREATE DATABASE IF NOT EXISTS college_chatbot_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON college_chatbot_test.* TO 'college_user'@'%';
FLUSH PRIVILEGES;
