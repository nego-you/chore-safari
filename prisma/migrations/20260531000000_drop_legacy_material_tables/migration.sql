-- レガシークラフト系の撤去に伴い、未使用の素材テーブルを削除する。
--   craftItem（唯一の読み手）とクレーンの UserMaterial 書き込みを撤去済み。
--   UserTool（パッシブ罠）は温存。

-- DropTable（user_materials は materials/users への FK を持つため先に削除）
DROP TABLE IF EXISTS "user_materials";
DROP TABLE IF EXISTS "materials";
