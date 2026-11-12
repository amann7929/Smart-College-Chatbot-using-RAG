-- ClgBot - MySQL 8 database + user setup.  Run once as the MySQL root user:
--     mysql -u root -p < database/init.sql          (Windows: "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p < database\init.sql)
-- CHANGE THE PASSWORD below (letters + digits only, otherwise URL-encode it inside DATABASE_URL).

CREATE DATABASE IF NOT EXISTS college_chatbot
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS college_chatbot_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'college_user'@'localhost' IDENTIFIED BY 'ChangeThisDbPass123';
CREATE USER IF NOT EXISTS 'college_user'@'127.0.0.1' IDENTIFIED BY 'ChangeThisDbPass123';
CREATE USER IF NOT EXISTS 'college_user'@'%'         IDENTIFIED BY 'ChangeThisDbPass123';  -- needed for Docker; remove if not used

GRANT ALL PRIVILEGES ON college_chatbot.*      TO 'college_user'@'localhost', 'college_user'@'127.0.0.1', 'college_user'@'%';
GRANT ALL PRIVILEGES ON college_chatbot_test.* TO 'college_user'@'localhost', 'college_user'@'127.0.0.1', 'college_user'@'%';
FLUSH PRIVILEGES;
