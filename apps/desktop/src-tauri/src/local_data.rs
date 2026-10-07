use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Utc;
use image::GenericImageView;
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
    thread,
    time::Duration,
};

const MAX_ASSET_BYTES: u64 = 20 * 1024 * 1024;
const MAX_REMOTE_RESULT_BYTES: usize = 20 * 1024 * 1024;
const MIGRATION_1: &str = r#"
CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, local_root_path TEXT NOT NULL UNIQUE, thumbnail_asset_id TEXT, project_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_opened_at TEXT NOT NULL);
CREATE TABLE assets (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, type TEXT NOT NULL, source TEXT NOT NULL, file_name TEXT NOT NULL, relative_path TEXT NOT NULL, mime_type TEXT NOT NULL, file_size INTEGER NOT NULL, width INTEGER, height INTEGER, duration REAL, hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(project_id, hash, source));
CREATE TABLE tasks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, workflow TEXT NOT NULL, status TEXT NOT NULL, input_json TEXT NOT NULL, output_json TEXT, error_json TEXT, progress INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, started_at TEXT, completed_at TEXT, updated_at TEXT NOT NULL);
CREATE TABLE results (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE, type TEXT NOT NULL, relative_path TEXT NOT NULL, mime_type TEXT NOT NULL, file_size INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX assets_project_idx ON assets(project_id); CREATE INDEX tasks_project_idx ON tasks(project_id); CREATE INDEX results_project_idx ON results(project_id);
"#;
const MIGRATION_2: &str = r#"
ALTER TABLE assets ADD COLUMN asset_role TEXT NOT NULL DEFAULT 'INPUT';
ALTER TABLE assets ADD COLUMN upload_status TEXT NOT NULL DEFAULT 'LOCAL';
ALTER TABLE assets ADD COLUMN remote_reference_id TEXT;
ALTER TABLE assets ADD COLUMN expires_at TEXT;
UPDATE assets SET asset_role='GENERATED_RESULT' WHERE source='generated';
CREATE INDEX assets_project_role_idx ON assets(project_id, asset_role);
"#;

#[derive(Clone)]
pub struct LocalData {
    pub root: PathBuf,
    pub database_path: PathBuf,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocalProject {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: String,
    pub local_root_path: String,
    pub thumbnail_asset_id: Option<String>,
    pub project_version: i64,
    pub asset_count: i64,
    pub task_count: i64,
    pub result_count: i64,
    pub created_at: String,
    pub updated_at: String,
    pub last_opened_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocalAsset {
    pub id: String,
    pub project_id: String,
    #[serde(rename = "type")]
    pub asset_type: String,
    pub source: String,
    pub file_name: String,
    pub relative_path: String,
    pub mime_type: String,
    pub file_size: i64,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub duration: Option<f64>,
    pub hash: String,
    pub role: String,
    pub upload_status: String,
    pub remote_reference_id: Option<String>,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocalTask {
    pub id: String,
    pub project_id: String,
    pub workflow: String,
    pub status: String,
    pub input: serde_json::Value,
    pub output: Option<serde_json::Value>,
    pub error: Option<serde_json::Value>,
    pub progress: i64,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedResult {
    pub id: String,
    pub project_id: String,
    pub task_id: String,
    pub asset_id: String,
    #[serde(rename = "type")]
    pub result_type: String,
    pub relative_path: String,
    pub mime_type: String,
    pub file_size: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalDataInfo {
    pub root_path: String,
    pub database_path: String,
    pub schema_version: i64,
}

fn now() -> String {
    Utc::now().to_rfc3339()
}
fn err(error: impl std::fmt::Display) -> String {
    error.to_string()
}
fn path_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

impl LocalData {
    pub fn new(root: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&root).map_err(err)?;
        let this = Self {
            database_path: root.join("weavia.db"),
            root,
        };
        this.migrate()?;
        this.recover_tasks()?;
        Ok(this)
    }

    fn connection(&self) -> Result<Connection, String> {
        let connection = Connection::open(&self.database_path).map_err(err)?;
        connection
            .execute_batch(
                "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;",
            )
            .map_err(err)?;
        Ok(connection)
    }

    pub fn migrate(&self) -> Result<i64, String> {
        let mut connection = self.connection()?;
        connection.execute_batch("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);").map_err(err)?;
        let version: i64 = connection
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
                [],
                |row| row.get(0),
            )
            .map_err(err)?;
        if version < 1 {
            let transaction = connection.transaction().map_err(err)?;
            transaction.execute_batch(MIGRATION_1).map_err(err)?;
            transaction
                .execute(
                    "INSERT INTO schema_migrations(version, applied_at) VALUES(1, ?1)",
                    [now()],
                )
                .map_err(err)?;
            transaction.commit().map_err(err)?;
        }
        if version < 2 {
            let transaction = connection.transaction().map_err(err)?;
            transaction.execute_batch(MIGRATION_2).map_err(err)?;
            transaction
                .execute(
                    "INSERT INTO schema_migrations(version, applied_at) VALUES(2, ?1)",
                    [now()],
                )
                .map_err(err)?;
            transaction.commit().map_err(err)?;
        }
        Ok(2)
    }

    pub fn info(&self) -> Result<LocalDataInfo, String> {
        Ok(LocalDataInfo {
            root_path: path_string(&self.root),
            database_path: path_string(&self.database_path),
            schema_version: self.migrate()?,
        })
    }

    fn project_root(&self, id: &str) -> PathBuf {
        self.root.join("projects").join(id)
    }
    fn create_directories(&self, id: &str) -> Result<PathBuf, String> {
        let root = self.project_root(id);
        for relative in [
            "assets/originals",
            "assets/processed",
            "generated/images",
            "generated/videos",
            "cache/thumbnails",
            "exports",
        ] {
            fs::create_dir_all(root.join(relative)).map_err(err)?;
        }
        Ok(root)
    }

    pub fn create_project(&self, name: &str, description: &str) -> Result<LocalProject, String> {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err("项目名称不能为空".into());
        }
        let id = uuid::Uuid::new_v4().to_string();
        let root = self.create_directories(&id)?;
        let timestamp = now();
        let result = self.connection()?.execute("INSERT INTO projects(id,name,description,status,local_root_path,project_version,created_at,updated_at,last_opened_at) VALUES(?1,?2,?3,'active',?4,1,?5,?5,?5)", params![id, trimmed, description.trim(), path_string(&root), timestamp]);
        if let Err(error) = result {
            let _ = fs::remove_dir_all(&root);
            return Err(err(error));
        }
        self.get_project(&id)?.ok_or_else(|| "项目创建失败".into())
    }

    pub fn get_project(&self, id: &str) -> Result<Option<LocalProject>, String> {
        self.connection()?.query_row("SELECT p.id,p.name,p.description,p.status,p.local_root_path,p.thumbnail_asset_id,p.project_version,(SELECT COUNT(*) FROM assets a WHERE a.project_id=p.id),(SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id),(SELECT COUNT(*) FROM results r WHERE r.project_id=p.id),p.created_at,p.updated_at,p.last_opened_at FROM projects p WHERE p.id=?1", [id], project_from_row).optional().map_err(err)
    }

    pub fn list_projects(&self) -> Result<Vec<LocalProject>, String> {
        let connection = self.connection()?;
        let mut statement = connection.prepare("SELECT p.id,p.name,p.description,p.status,p.local_root_path,p.thumbnail_asset_id,p.project_version,(SELECT COUNT(*) FROM assets a WHERE a.project_id=p.id),(SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id),(SELECT COUNT(*) FROM results r WHERE r.project_id=p.id),p.created_at,p.updated_at,p.last_opened_at FROM projects p ORDER BY p.last_opened_at DESC").map_err(err)?;
        let projects = statement
            .query_map([], project_from_row)
            .map_err(err)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(err)?;
        Ok(projects)
    }

    pub fn update_project(
        &self,
        id: &str,
        name: &str,
        description: &str,
    ) -> Result<LocalProject, String> {
        let timestamp = now();
        let changed = self.connection()?.execute("UPDATE projects SET name=?2,description=?3,updated_at=?4,last_opened_at=?4 WHERE id=?1", params![id, name.trim(), description.trim(), timestamp]).map_err(err)?;
        if changed == 0 {
            return Err("项目不存在".into());
        }
        self.get_project(id)?.ok_or_else(|| "项目不存在".into())
    }

    pub fn open_project(&self, id: &str) -> Result<LocalProject, String> {
        let timestamp = now();
        self.connection()?
            .execute(
                "UPDATE projects SET last_opened_at=?2 WHERE id=?1",
                params![id, timestamp],
            )
            .map_err(err)?;
        self.get_project(id)?.ok_or_else(|| "项目不存在".into())
    }

    pub fn delete_project(&self, id: &str) -> Result<(), String> {
        let project = self
            .get_project(id)?
            .ok_or_else(|| "项目不存在".to_string())?;
        let original = PathBuf::from(&project.local_root_path);
        let quarantine = self.root.join(format!(".deleting-{id}"));
        if original.exists() {
            fs::rename(&original, &quarantine).map_err(err)?;
        }
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(err)?;
        if let Err(error) = transaction.execute("DELETE FROM projects WHERE id=?1", [id]) {
            if quarantine.exists() {
                let _ = fs::rename(&quarantine, &original);
            }
            return Err(err(error));
        }
        if let Err(error) = transaction.commit() {
            if quarantine.exists() {
                let _ = fs::rename(&quarantine, &original);
            }
            return Err(err(error));
        }
        if quarantine.exists() {
            fs::remove_dir_all(&quarantine).map_err(err)?;
        }
        Ok(())
    }

    pub fn import_asset(&self, project_id: &str, source: &Path) -> Result<LocalAsset, String> {
        let project = self
            .get_project(project_id)?
            .ok_or_else(|| "项目不存在".to_string())?;
        let metadata = fs::metadata(source).map_err(err)?;
        if !metadata.is_file() {
            return Err("素材文件不存在".into());
        }
        if metadata.len() > MAX_ASSET_BYTES {
            return Err("素材超过 20 MB".into());
        }
        let bytes = fs::read(source).map_err(err)?;
        let decoded =
            image::load_from_memory(&bytes).map_err(|_| "不支持或损坏的图片".to_string())?;
        let format = image::guess_format(&bytes).map_err(|_| "无法识别图片格式".to_string())?;
        let (mime, extension) = match format {
            image::ImageFormat::Png => ("image/png", "png"),
            image::ImageFormat::Jpeg => ("image/jpeg", "jpg"),
            image::ImageFormat::WebP => ("image/webp", "webp"),
            _ => return Err("仅支持 PNG、JPG、JPEG、WEBP".into()),
        };
        let hash = format!("{:x}", Sha256::digest(&bytes));
        if let Some(asset) = self.find_asset_by_hash(project_id, &hash)? {
            return Ok(asset);
        }
        let id = uuid::Uuid::new_v4().to_string();
        let file_name = format!("{id}.{extension}");
        let relative = format!("assets/originals/{file_name}");
        let final_path = PathBuf::from(&project.local_root_path).join(&relative);
        let temporary = final_path.with_extension(format!("{extension}.importing"));
        fs::write(&temporary, &bytes).map_err(err)?;
        let timestamp = now();
        let (width, height) = decoded.dimensions();
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(err)?;
        if let Err(error) = transaction.execute("INSERT INTO assets(id,project_id,type,source,file_name,relative_path,mime_type,file_size,width,height,hash,created_at,updated_at) VALUES(?1,?2,'image','imported',?3,?4,?5,?6,?7,?8,?9,?10,?10)", params![id,project_id,file_name,relative,mime,metadata.len() as i64,width as i64,height as i64,hash,timestamp]) { let _=fs::remove_file(&temporary); return Err(err(error)); }
        if let Err(error) = fs::rename(&temporary, &final_path) {
            let _ = fs::remove_file(&temporary);
            return Err(err(error));
        }
        if let Err(error) = transaction.commit() {
            let _ = fs::remove_file(&final_path);
            return Err(err(error));
        }
        self.get_asset(&id)?.ok_or_else(|| "素材导入失败".into())
    }

    fn find_asset_by_hash(
        &self,
        project_id: &str,
        hash: &str,
    ) -> Result<Option<LocalAsset>, String> {
        self.connection()?.query_row("SELECT id,project_id,type,source,file_name,relative_path,mime_type,file_size,width,height,duration,hash,asset_role,upload_status,remote_reference_id,expires_at,created_at,updated_at FROM assets WHERE project_id=?1 AND hash=?2 AND source='imported'", params![project_id,hash], asset_from_row).optional().map_err(err)
    }
    pub fn get_asset(&self, id: &str) -> Result<Option<LocalAsset>, String> {
        self.connection()?.query_row("SELECT id,project_id,type,source,file_name,relative_path,mime_type,file_size,width,height,duration,hash,asset_role,upload_status,remote_reference_id,expires_at,created_at,updated_at FROM assets WHERE id=?1", [id], asset_from_row).optional().map_err(err)
    }
    pub fn list_assets(&self, project_id: &str) -> Result<Vec<LocalAsset>, String> {
        query_assets(&self.connection()?, "SELECT id,project_id,type,source,file_name,relative_path,mime_type,file_size,width,height,duration,hash,asset_role,upload_status,remote_reference_id,expires_at,created_at,updated_at FROM assets WHERE project_id=?1 ORDER BY created_at DESC", project_id)
    }

    pub fn set_asset_role(&self, asset_id: &str, role: &str) -> Result<LocalAsset, String> {
        if !matches!(role, "INPUT" | "REFERENCE_IMAGE" | "GENERATED_RESULT") {
            return Err("素材角色无效".into());
        }
        let asset = self
            .get_asset(asset_id)?
            .ok_or_else(|| "素材不存在".to_string())?;
        if asset.source == "generated" && role != "GENERATED_RESULT" {
            return Err("生成结果不能设为参考图".into());
        }
        self.connection()?
            .execute(
                "UPDATE assets SET asset_role=?2,updated_at=?3 WHERE id=?1",
                params![asset_id, role, now()],
            )
            .map_err(err)?;
        self.get_asset(asset_id)?.ok_or_else(|| "素材不存在".into())
    }

    pub fn update_asset_upload(
        &self,
        asset_id: &str,
        status: &str,
        remote_reference_id: Option<&str>,
        expires_at: Option<&str>,
    ) -> Result<LocalAsset, String> {
        if !matches!(
            status,
            "LOCAL" | "PENDING" | "UPLOADED" | "FAILED" | "EXPIRED"
        ) {
            return Err("上传状态无效".into());
        }
        self.connection()?.execute(
            "UPDATE assets SET upload_status=?2,remote_reference_id=?3,expires_at=?4,updated_at=?5 WHERE id=?1",
            params![asset_id, status, remote_reference_id, expires_at, now()],
        ).map_err(err)?;
        self.get_asset(asset_id)?.ok_or_else(|| "素材不存在".into())
    }

    pub fn create_task(&self, task: &LocalTask) -> Result<(), String> {
        self.connection()?.execute("INSERT INTO tasks(id,project_id,workflow,status,input_json,output_json,error_json,progress,created_at,started_at,completed_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)", params![task.id,task.project_id,task.workflow,task.status,task.input.to_string(),task.output.as_ref().map(|v|v.to_string()),task.error.as_ref().map(|v|v.to_string()),task.progress,task.created_at,task.started_at,task.completed_at,task.updated_at]).map_err(err)?;
        Ok(())
    }
    pub fn update_task(&self, task: &LocalTask) -> Result<(), String> {
        self.connection()?.execute("UPDATE tasks SET status=?2,input_json=?3,output_json=?4,error_json=?5,progress=?6,started_at=?7,completed_at=?8,updated_at=?9 WHERE id=?1", params![task.id,task.status,task.input.to_string(),task.output.as_ref().map(|v|v.to_string()),task.error.as_ref().map(|v|v.to_string()),task.progress,task.started_at,task.completed_at,task.updated_at]).map_err(err)?;
        Ok(())
    }
    pub fn get_task(&self, id: &str) -> Result<Option<LocalTask>, String> {
        self.connection()?.query_row("SELECT id,project_id,workflow,status,input_json,output_json,error_json,progress,created_at,started_at,completed_at,updated_at FROM tasks WHERE id=?1", [id], task_from_row).optional().map_err(err)
    }
    pub fn list_tasks(&self, project_id: Option<&str>) -> Result<Vec<LocalTask>, String> {
        let connection = self.connection()?;
        let sql = if project_id.is_some() {
            "SELECT id,project_id,workflow,status,input_json,output_json,error_json,progress,created_at,started_at,completed_at,updated_at FROM tasks WHERE project_id=?1 ORDER BY created_at DESC"
        } else {
            "SELECT id,project_id,workflow,status,input_json,output_json,error_json,progress,created_at,started_at,completed_at,updated_at FROM tasks ORDER BY created_at DESC"
        };
        let mut statement = connection.prepare(sql).map_err(err)?;
        let rows = if let Some(id) = project_id {
            statement
                .query_map([id], task_from_row)
                .map_err(err)?
                .collect::<Result<Vec<_>, _>>()
        } else {
            statement
                .query_map([], task_from_row)
                .map_err(err)?
                .collect::<Result<Vec<_>, _>>()
        };
        rows.map_err(err)
    }

    pub fn recover_tasks(&self) -> Result<usize, String> {
        let timestamp = now();
        self.connection()?.execute("UPDATE tasks SET status='failed',error_json='{\"code\":\"INTERRUPTED\",\"message\":\"应用退出导致任务中断，可重新创建任务\"}',completed_at=?1,updated_at=?1 WHERE status IN ('pending','queued','uploading','running','downloading')", [timestamp]).map_err(err)
    }

    pub fn execute_mock_task(
        &self,
        task_id: &str,
        asset_id: &str,
    ) -> Result<GeneratedResult, String> {
        let mut task = self
            .get_task(task_id)?
            .ok_or_else(|| "任务不存在".to_string())?;
        let source = self
            .get_asset(asset_id)?
            .ok_or_else(|| "素材不存在".to_string())?;
        if source.project_id != task.project_id {
            return Err("素材不属于当前项目".into());
        }
        task.status = "running".into();
        task.progress = 10;
        task.started_at = Some(now());
        task.updated_at = now();
        self.update_task(&task)?;
        thread::sleep(Duration::from_millis(20));
        task.progress = 35;
        task.updated_at = now();
        self.update_task(&task)?;
        thread::sleep(Duration::from_millis(20));
        let project = self
            .get_project(&task.project_id)?
            .ok_or_else(|| "项目不存在".to_string())?;
        let source_path = PathBuf::from(&project.local_root_path).join(&source.relative_path);
        let bytes = fs::read(&source_path).map_err(err)?;
        task.progress = 70;
        task.updated_at = now();
        self.update_task(&task)?;
        let generated_asset_id = uuid::Uuid::new_v4().to_string();
        let extension = Path::new(&source.file_name)
            .extension()
            .and_then(|x| x.to_str())
            .unwrap_or("png");
        let file_name = format!("mock-{generated_asset_id}.{extension}");
        let relative = format!("generated/images/{file_name}");
        let final_path = PathBuf::from(&project.local_root_path).join(&relative);
        let temporary = final_path.with_extension(format!("{extension}.generating"));
        fs::write(&temporary, &bytes).map_err(err)?;
        let timestamp = now();
        let hash = format!("{:x}", Sha256::digest(&bytes));
        let result_id = uuid::Uuid::new_v4().to_string();
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(err)?;
        register_generated(
            &transaction,
            &generated_asset_id,
            &task.project_id,
            &file_name,
            &relative,
            &source.mime_type,
            bytes.len() as i64,
            source.width,
            source.height,
            &hash,
            &timestamp,
            &result_id,
            &task.id,
        )
        .inspect_err(|_| {
            let _ = fs::remove_file(&temporary);
        })?;
        fs::rename(&temporary, &final_path).map_err(|error| {
            let _ = fs::remove_file(&temporary);
            err(error)
        })?;
        task.status = "success".into();
        task.progress = 100;
        task.completed_at = Some(timestamp.clone());
        task.updated_at = timestamp.clone();
        task.output = Some(
            serde_json::json!({"resultId":result_id,"assetId":generated_asset_id,"relativePath":relative}),
        );
        if let Err(error)=transaction.execute("UPDATE tasks SET status='success',progress=100,output_json=?2,completed_at=?3,updated_at=?3 WHERE id=?1",params![task.id,task.output.as_ref().unwrap().to_string(),timestamp]){let _=fs::remove_file(&final_path);return Err(err(error));}
        if let Err(error) = transaction.commit() {
            let _ = fs::remove_file(&final_path);
            return Err(err(error));
        }
        self.get_result(&result_id)?
            .ok_or_else(|| "生成结果保存失败".into())
    }

    pub fn save_remote_generated_result(
        &self,
        task_id: &str,
        remote_source: &str,
        expected_mime_type: &str,
    ) -> Result<GeneratedResult, String> {
        let mut task = self
            .get_task(task_id)?
            .ok_or_else(|| "任务不存在".to_string())?;
        if task.status == "success" {
            if let Some(result_id) = task
                .output
                .as_ref()
                .and_then(|value| value.get("resultId"))
                .and_then(|value| value.as_str())
            {
                return self
                    .get_result(result_id)?
                    .ok_or_else(|| "本地结果记录不存在".into());
            }
        }
        task.status = "downloading".into();
        task.progress = 85;
        task.updated_at = now();
        self.update_task(&task)?;
        let (bytes, mime, extension, width, height) =
            match download_result(remote_source, expected_mime_type) {
                Ok(value) => value,
                Err(error) => {
                    task.status = "reconciling".into();
                    task.error = Some(serde_json::json!({
                        "code":"RESULT_DOWNLOAD_FAILED",
                        "message":error,
                        "retryable":true
                    }));
                    task.updated_at = now();
                    self.update_task(&task)?;
                    return Err(error);
                }
            };
        let project = self
            .get_project(&task.project_id)?
            .ok_or_else(|| "项目不存在".to_string())?;
        let generated_asset_id = uuid::Uuid::new_v4().to_string();
        let file_name = format!("ai-{generated_asset_id}.{extension}");
        let relative = format!("generated/images/{file_name}");
        let final_path = PathBuf::from(&project.local_root_path).join(&relative);
        let temporary = final_path.with_extension(format!("{extension}.downloading"));
        fs::write(&temporary, &bytes).map_err(err)?;
        let timestamp = now();
        let hash = format!("{:x}", Sha256::digest(&bytes));
        let result_id = uuid::Uuid::new_v4().to_string();
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(err)?;
        register_generated(
            &transaction,
            &generated_asset_id,
            &task.project_id,
            &file_name,
            &relative,
            &mime,
            bytes.len() as i64,
            Some(width as i64),
            Some(height as i64),
            &hash,
            &timestamp,
            &result_id,
            &task.id,
        )
        .inspect_err(|_| {
            let _ = fs::remove_file(&temporary);
        })?;
        fs::rename(&temporary, &final_path).map_err(|error| {
            let _ = fs::remove_file(&temporary);
            err(error)
        })?;
        let output = serde_json::json!({
            "resultId":result_id,
            "assetId":generated_asset_id,
            "relativePath":relative,
            "deliveryStatus":"local_saved"
        });
        if let Err(error) = transaction.execute(
            "UPDATE tasks SET status='success',progress=100,output_json=?2,error_json=NULL,completed_at=?3,updated_at=?3 WHERE id=?1",
            params![task.id, output.to_string(), timestamp],
        ) {
            let _ = fs::remove_file(&final_path);
            return Err(err(error));
        }
        if let Err(error) = transaction.commit() {
            let _ = fs::remove_file(&final_path);
            return Err(err(error));
        }
        self.get_result(&result_id)?
            .ok_or_else(|| "生成结果保存失败".into())
    }

    pub fn get_result(&self, id: &str) -> Result<Option<GeneratedResult>, String> {
        self.connection()?.query_row("SELECT id,project_id,task_id,asset_id,type,relative_path,mime_type,file_size,created_at FROM results WHERE id=?1",[id],result_from_row).optional().map_err(err)
    }
    pub fn list_results(&self, project_id: &str) -> Result<Vec<GeneratedResult>, String> {
        let connection = self.connection()?;
        let mut statement=connection.prepare("SELECT id,project_id,task_id,asset_id,type,relative_path,mime_type,file_size,created_at FROM results WHERE project_id=?1 ORDER BY created_at DESC").map_err(err)?;
        let results = statement
            .query_map([project_id], result_from_row)
            .map_err(err)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(err)?;
        Ok(results)
    }
    pub fn asset_data_url(&self, asset_id: &str) -> Result<String, String> {
        let asset = self
            .get_asset(asset_id)?
            .ok_or_else(|| "素材不存在".to_string())?;
        let project = self
            .get_project(&asset.project_id)?
            .ok_or_else(|| "项目不存在".to_string())?;
        let bytes = fs::read(PathBuf::from(project.local_root_path).join(asset.relative_path))
            .map_err(err)?;
        Ok(format!(
            "data:{};base64,{}",
            asset.mime_type,
            STANDARD.encode(bytes)
        ))
    }
    pub fn set_setting(&self, key: &str, value: &serde_json::Value) -> Result<(), String> {
        self.connection()?.execute("INSERT INTO settings(key,value_json,updated_at) VALUES(?1,?2,?3) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",params![key,value.to_string(),now()]).map_err(err)?;
        Ok(())
    }
    pub fn get_setting(&self, key: &str) -> Result<Option<serde_json::Value>, String> {
        let raw: Option<String> = self
            .connection()?
            .query_row(
                "SELECT value_json FROM settings WHERE key=?1",
                [key],
                |row| row.get(0),
            )
            .optional()
            .map_err(err)?;
        raw.map(|value| serde_json::from_str(&value).map_err(err))
            .transpose()
    }
}

fn download_result(
    source: &str,
    expected_mime_type: &str,
) -> Result<(Vec<u8>, String, &'static str, u32, u32), String> {
    if !matches!(
        expected_mime_type,
        "image/png" | "image/jpeg" | "image/webp"
    ) {
        return Err("结果 MIME 不受支持".into());
    }
    let (bytes, response_mime) = if source.starts_with("data:") {
        let (metadata, payload) = source
            .split_once(',')
            .ok_or_else(|| "结果 Data URL 无效".to_string())?;
        if metadata != format!("data:{expected_mime_type};base64") {
            return Err("结果 Data URL MIME 不匹配".into());
        }
        (
            STANDARD.decode(payload).map_err(|_| "结果 Base64 无效")?,
            expected_mime_type.to_owned(),
        )
    } else {
        let url = reqwest::Url::parse(source).map_err(|_| "结果 URL 无效")?;
        if url.scheme() != "https" {
            return Err("结果只允许 HTTPS URL".into());
        }
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(120))
            .redirect(reqwest::redirect::Policy::limited(5))
            .build()
            .map_err(err)?;
        let response = client
            .get(url)
            .send()
            .map_err(err)?
            .error_for_status()
            .map_err(err)?;
        if response.content_length().unwrap_or(0) > MAX_REMOTE_RESULT_BYTES as u64 {
            return Err("结果文件超过 20 MB".into());
        }
        let mime = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split(';').next())
            .unwrap_or("")
            .to_owned();
        let bytes = response.bytes().map_err(err)?.to_vec();
        (bytes, mime)
    };
    if bytes.len() > MAX_REMOTE_RESULT_BYTES {
        return Err("结果文件超过 20 MB".into());
    }
    if response_mime != expected_mime_type {
        return Err("结果响应 MIME 不匹配".into());
    }
    let format = image::guess_format(&bytes).map_err(|_| "结果不是有效图片")?;
    let (actual_mime, extension) = match format {
        image::ImageFormat::Png => ("image/png", "png"),
        image::ImageFormat::Jpeg => ("image/jpeg", "jpg"),
        image::ImageFormat::WebP => ("image/webp", "webp"),
        _ => return Err("结果图片格式不受支持".into()),
    };
    if actual_mime != expected_mime_type {
        return Err("结果内容与 MIME 不匹配".into());
    }
    let decoded = image::load_from_memory(&bytes).map_err(|_| "结果图片损坏")?;
    let (width, height) = decoded.dimensions();
    Ok((bytes, actual_mime.into(), extension, width, height))
}

fn project_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<LocalProject> {
    Ok(LocalProject {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        status: row.get(3)?,
        local_root_path: row.get(4)?,
        thumbnail_asset_id: row.get(5)?,
        project_version: row.get(6)?,
        asset_count: row.get(7)?,
        task_count: row.get(8)?,
        result_count: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        last_opened_at: row.get(12)?,
    })
}
fn asset_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<LocalAsset> {
    Ok(LocalAsset {
        id: row.get(0)?,
        project_id: row.get(1)?,
        asset_type: row.get(2)?,
        source: row.get(3)?,
        file_name: row.get(4)?,
        relative_path: row.get(5)?,
        mime_type: row.get(6)?,
        file_size: row.get(7)?,
        width: row.get(8)?,
        height: row.get(9)?,
        duration: row.get(10)?,
        hash: row.get(11)?,
        role: row.get(12)?,
        upload_status: row.get(13)?,
        remote_reference_id: row.get(14)?,
        expires_at: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
    })
}
fn task_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<LocalTask> {
    let parse = |index| -> rusqlite::Result<Option<serde_json::Value>> {
        let value: Option<String> = row.get(index)?;
        Ok(value.and_then(|x| serde_json::from_str(&x).ok()))
    };
    let input: String = row.get(4)?;
    Ok(LocalTask {
        id: row.get(0)?,
        project_id: row.get(1)?,
        workflow: row.get(2)?,
        status: row.get(3)?,
        input: serde_json::from_str(&input).unwrap_or(serde_json::Value::Null),
        output: parse(5)?,
        error: parse(6)?,
        progress: row.get(7)?,
        created_at: row.get(8)?,
        started_at: row.get(9)?,
        completed_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}
fn result_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<GeneratedResult> {
    Ok(GeneratedResult {
        id: row.get(0)?,
        project_id: row.get(1)?,
        task_id: row.get(2)?,
        asset_id: row.get(3)?,
        result_type: row.get(4)?,
        relative_path: row.get(5)?,
        mime_type: row.get(6)?,
        file_size: row.get(7)?,
        created_at: row.get(8)?,
    })
}
fn query_assets(
    connection: &Connection,
    sql: &str,
    project_id: &str,
) -> Result<Vec<LocalAsset>, String> {
    let mut statement = connection.prepare(sql).map_err(err)?;
    let assets = statement
        .query_map([project_id], asset_from_row)
        .map_err(err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(err)?;
    Ok(assets)
}
fn register_generated(
    transaction: &Transaction<'_>,
    asset_id: &str,
    project_id: &str,
    file_name: &str,
    relative: &str,
    mime: &str,
    size: i64,
    width: Option<i64>,
    height: Option<i64>,
    hash: &str,
    timestamp: &str,
    result_id: &str,
    task_id: &str,
) -> Result<(), String> {
    transaction.execute("INSERT INTO assets(id,project_id,type,source,file_name,relative_path,mime_type,file_size,width,height,hash,asset_role,created_at,updated_at) VALUES(?1,?2,'image','generated',?3,?4,?5,?6,?7,?8,?9,'GENERATED_RESULT',?10,?10)",params![asset_id,project_id,file_name,relative,mime,size,width,height,hash,timestamp]).map_err(err)?;
    transaction.execute("INSERT INTO results(id,project_id,task_id,asset_id,type,relative_path,mime_type,file_size,created_at) VALUES(?1,?2,?3,?4,'image',?5,?6,?7,?8)",params![result_id,project_id,task_id,asset_id,relative,mime,size,timestamp]).map_err(err)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};
    fn setup() -> (tempfile::TempDir, LocalData) {
        let dir = tempfile::tempdir().unwrap();
        let data = LocalData::new(dir.path().join("WEAVIA")).unwrap();
        (dir, data)
    }
    fn fixture(path: &Path) {
        let image = ImageBuffer::from_pixel(3, 2, Rgba([120u8, 80, 40, 255]));
        image.save(path).unwrap();
    }
    fn task(project_id: &str, status: &str, asset_id: Option<&str>) -> LocalTask {
        let timestamp = now();
        LocalTask {
            id: uuid::Uuid::new_v4().to_string(),
            project_id: project_id.to_owned(),
            workflow: "ai_model".into(),
            status: status.into(),
            input: asset_id
                .map(|id| serde_json::json!({"assetId":id,"projectId":project_id}))
                .unwrap_or_else(|| serde_json::json!({"projectId":project_id})),
            output: None,
            error: None,
            progress: 0,
            created_at: timestamp.clone(),
            started_at: None,
            completed_at: None,
            updated_at: timestamp,
        }
    }
    #[test]
    fn migration_and_restart() {
        let (dir, data) = setup();
        assert_eq!(data.info().unwrap().schema_version, 2);
        drop(data);
        assert_eq!(
            LocalData::new(dir.path().join("WEAVIA"))
                .unwrap()
                .list_projects()
                .unwrap()
                .len(),
            0
        );
    }
    #[test]
    fn project_crud_and_directories() {
        let (_dir, data) = setup();
        let mut project = data.create_project("Product", "Demo").unwrap();
        for relative in [
            "assets/originals",
            "assets/processed",
            "generated/images",
            "generated/videos",
            "cache/thumbnails",
            "exports",
        ] {
            assert!(Path::new(&project.local_root_path).join(relative).is_dir());
        }
        project = data
            .update_project(&project.id, "Renamed", "Updated")
            .unwrap();
        assert_eq!(project.name, "Renamed");
        assert_eq!(
            data.open_project(&project.id).unwrap().description,
            "Updated"
        );
        data.delete_project(&project.id).unwrap();
        assert!(data.get_project(&project.id).unwrap().is_none());
        assert!(!Path::new(&project.local_root_path).exists());
    }
    #[test]
    fn import_metadata_hash_dedup_and_invalid() {
        let (dir, data) = setup();
        let project = data.create_project("Assets", "").unwrap();
        let path = dir.path().join("input.png");
        fixture(&path);
        let first = data.import_asset(&project.id, &path).unwrap();
        assert_eq!(first.role, "INPUT");
        assert_eq!((first.width, first.height), (Some(3), Some(2)));
        assert_eq!(
            first.hash,
            format!("{:x}", Sha256::digest(fs::read(&path).unwrap()))
        );
        assert!(Path::new(&project.local_root_path)
            .join(&first.relative_path)
            .is_file());
        let second = data.import_asset(&project.id, &path).unwrap();
        assert_eq!(first.id, second.id);
        let bad = dir.path().join("bad.jpg");
        fs::write(&bad, b"invalid").unwrap();
        assert!(data.import_asset(&project.id, &bad).is_err());
        assert_eq!(data.list_assets(&project.id).unwrap().len(), 1);
    }
    #[test]
    fn reference_asset_role_and_upload_metadata_persist() {
        let (dir, data) = setup();
        let project = data.create_project("Reference", "").unwrap();
        let path = dir.path().join("reference.png");
        fixture(&path);
        let asset = data.import_asset(&project.id, &path).unwrap();
        let asset = data.set_asset_role(&asset.id, "REFERENCE_IMAGE").unwrap();
        assert_eq!(asset.role, "REFERENCE_IMAGE");
        let asset = data
            .update_asset_upload(
                &asset.id,
                "UPLOADED",
                Some("references/user/asset.png"),
                Some("2026-10-07T00:10:00Z"),
            )
            .unwrap();
        assert_eq!(asset.upload_status, "UPLOADED");
        let mut reference_task = task(&project.id, "queued", Some(&asset.id));
        reference_task.workflow = "ai_commercial".into();
        reference_task.input = serde_json::json!({
            "workflow":"product_image_generation",
            "referenceAssets":[asset.id.clone()],
            "logicalModel":"weavia-image-pro"
        });
        data.create_task(&reference_task).unwrap();
        drop(data);
        let restarted = LocalData::new(dir.path().join("WEAVIA")).unwrap();
        let persisted = restarted.get_asset(&asset.id).unwrap().unwrap();
        assert_eq!(persisted.role, "REFERENCE_IMAGE");
        assert_eq!(
            persisted.remote_reference_id.as_deref(),
            Some("references/user/asset.png")
        );
        assert_eq!(
            restarted
                .get_task(&reference_task.id)
                .unwrap()
                .unwrap()
                .input["referenceAssets"][0],
            asset.id
        );
    }
    #[test]
    fn task_result_persistence_and_recovery() {
        let (dir, data) = setup();
        let project = data.create_project("Workflow", "").unwrap();
        let path = dir.path().join("input.png");
        fixture(&path);
        let asset = data.import_asset(&project.id, &path).unwrap();
        let timestamp = now();
        let task = LocalTask {
            id: uuid::Uuid::new_v4().to_string(),
            project_id: project.id.clone(),
            workflow: "ai_model".into(),
            status: "queued".into(),
            input: serde_json::json!({"assetId":asset.id}),
            output: None,
            error: None,
            progress: 0,
            created_at: timestamp.clone(),
            started_at: None,
            completed_at: None,
            updated_at: timestamp,
        };
        data.create_task(&task).unwrap();
        let result = data.execute_mock_task(&task.id, &asset.id).unwrap();
        assert!(Path::new(&project.local_root_path)
            .join(&result.relative_path)
            .is_file());
        drop(data);
        let restarted = LocalData::new(dir.path().join("WEAVIA")).unwrap();
        assert_eq!(
            restarted.get_task(&task.id).unwrap().unwrap().status,
            "success"
        );
        assert_eq!(restarted.list_results(&project.id).unwrap().len(), 1);
        assert_eq!(restarted.list_assets(&project.id).unwrap().len(), 2);
    }
    #[test]
    fn running_task_is_recovered_and_settings_persist() {
        let (dir, data) = setup();
        let project = data.create_project("Recovery", "").unwrap();
        let timestamp = now();
        let task = LocalTask {
            id: uuid::Uuid::new_v4().to_string(),
            project_id: project.id,
            workflow: "ai_model".into(),
            status: "running".into(),
            input: serde_json::json!({}),
            output: None,
            error: None,
            progress: 35,
            created_at: timestamp.clone(),
            started_at: Some(timestamp.clone()),
            completed_at: None,
            updated_at: timestamp,
        };
        data.create_task(&task).unwrap();
        data.set_setting("ui", &serde_json::json!({"density":"compact"}))
            .unwrap();
        drop(data);
        let restarted = LocalData::new(dir.path().join("WEAVIA")).unwrap();
        let recovered = restarted.get_task(&task.id).unwrap().unwrap();
        assert_eq!(recovered.status, "failed");
        assert_eq!(recovered.error.unwrap()["code"], "INTERRUPTED");
        assert_eq!(
            restarted.get_setting("ui").unwrap().unwrap()["density"],
            "compact"
        );
    }

    #[test]
    fn restart_preserves_project_asset_and_image_data() {
        let (dir, data) = setup();
        let project = data.create_project("Restart", "durable").unwrap();
        let source = dir.path().join("restart.png");
        fixture(&source);
        let asset = data.import_asset(&project.id, &source).unwrap();
        drop(data);

        let restarted = LocalData::new(dir.path().join("WEAVIA")).unwrap();
        assert_eq!(
            restarted.get_project(&project.id).unwrap().unwrap().name,
            "Restart"
        );
        assert_eq!(restarted.list_assets(&project.id).unwrap()[0].id, asset.id);
        assert!(restarted
            .asset_data_url(&asset.id)
            .unwrap()
            .starts_with("data:image/png;base64,"));
    }

    #[test]
    fn deleting_project_cascades_records_and_directory() {
        let (dir, data) = setup();
        let project = data.create_project("Cascade", "").unwrap();
        let source = dir.path().join("cascade.png");
        fixture(&source);
        let asset = data.import_asset(&project.id, &source).unwrap();
        let task = task(&project.id, "queued", Some(&asset.id));
        data.create_task(&task).unwrap();
        data.execute_mock_task(&task.id, &asset.id).unwrap();

        data.delete_project(&project.id).unwrap();
        assert!(data.list_assets(&project.id).unwrap().is_empty());
        assert!(data.list_tasks(Some(&project.id)).unwrap().is_empty());
        assert!(data.list_results(&project.id).unwrap().is_empty());
        assert!(!Path::new(&project.local_root_path).exists());
    }

    #[test]
    fn failed_file_import_does_not_create_database_record() {
        let (_dir, data) = setup();
        let project = data.create_project("Failures", "").unwrap();
        assert!(data
            .import_asset(&project.id, Path::new("/path/does/not/exist.png"))
            .is_err());
        assert!(data.list_assets(&project.id).unwrap().is_empty());
    }

    #[test]
    fn task_update_and_project_filter_are_persistent() {
        let (_dir, data) = setup();
        let first = data.create_project("First", "").unwrap();
        let second = data.create_project("Second", "").unwrap();
        let mut first_task = task(&first.id, "queued", None);
        let second_task = task(&second.id, "pending", None);
        data.create_task(&first_task).unwrap();
        data.create_task(&second_task).unwrap();
        first_task.status = "running".into();
        first_task.progress = 35;
        first_task.updated_at = now();
        data.update_task(&first_task).unwrap();

        let saved = data.get_task(&first_task.id).unwrap().unwrap();
        assert_eq!((saved.status.as_str(), saved.progress), ("running", 35));
        assert_eq!(data.list_tasks(Some(&first.id)).unwrap().len(), 1);
        assert_eq!(data.list_tasks(None).unwrap().len(), 2);
    }

    #[test]
    fn task_rejects_asset_from_another_project() {
        let (dir, data) = setup();
        let first = data.create_project("First", "").unwrap();
        let second = data.create_project("Second", "").unwrap();
        let source = dir.path().join("foreign.png");
        fixture(&source);
        let foreign_asset = data.import_asset(&second.id, &source).unwrap();
        let task = task(&first.id, "queued", Some(&foreign_asset.id));
        data.create_task(&task).unwrap();

        assert!(data.execute_mock_task(&task.id, &foreign_asset.id).is_err());
        assert!(data.list_results(&first.id).unwrap().is_empty());
        assert_eq!(data.get_task(&task.id).unwrap().unwrap().status, "queued");
    }

    #[test]
    fn remote_result_is_validated_registered_and_idempotent() {
        let (dir, data) = setup();
        let project = data.create_project("Cloud Result", "").unwrap();
        let source = dir.path().join("cloud.png");
        fixture(&source);
        let task = task(&project.id, "downloading", None);
        data.create_task(&task).unwrap();
        let data_url = format!(
            "data:image/png;base64,{}",
            STANDARD.encode(fs::read(&source).unwrap())
        );

        let first = data
            .save_remote_generated_result(&task.id, &data_url, "image/png")
            .unwrap();
        let second = data
            .save_remote_generated_result(&task.id, &data_url, "image/png")
            .unwrap();
        assert_eq!(first.id, second.id);
        assert!(Path::new(&project.local_root_path)
            .join(&first.relative_path)
            .is_file());
        assert_eq!(
            data.list_assets(&project.id).unwrap()[0].source,
            "generated"
        );
        assert_eq!(data.get_task(&task.id).unwrap().unwrap().status, "success");
    }

    #[test]
    fn invalid_remote_result_stays_reconciling_without_dirty_records() {
        let (dir, data) = setup();
        let project = data.create_project("Delivery Recovery", "").unwrap();
        let source = dir.path().join("wrong.png");
        fixture(&source);
        let task = task(&project.id, "downloading", None);
        data.create_task(&task).unwrap();
        let wrong_mime = format!(
            "data:image/jpeg;base64,{}",
            STANDARD.encode(fs::read(&source).unwrap())
        );

        assert!(data
            .save_remote_generated_result(&task.id, &wrong_mime, "image/jpeg")
            .is_err());
        assert!(data.list_results(&project.id).unwrap().is_empty());
        assert!(data.list_assets(&project.id).unwrap().is_empty());
        drop(data);
        let restarted = LocalData::new(dir.path().join("WEAVIA")).unwrap();
        assert_eq!(
            restarted.get_task(&task.id).unwrap().unwrap().status,
            "reconciling"
        );
    }

    #[test]
    fn remote_result_rejects_unsafe_protocol_and_oversized_payload() {
        assert!(
            download_result("http://example.com/result.png", "image/png")
                .unwrap_err()
                .contains("HTTPS")
        );
        let oversized = format!(
            "data:image/png;base64,{}",
            STANDARD.encode(vec![0_u8; MAX_REMOTE_RESULT_BYTES + 1])
        );
        assert!(download_result(&oversized, "image/png")
            .unwrap_err()
            .contains("20 MB"));
    }

    #[test]
    fn tests_use_isolated_temporary_app_data() {
        let (dir, data) = setup();
        assert!(data.root.starts_with(dir.path()));
        assert!(data.database_path.starts_with(dir.path()));
        assert_ne!(data.root, PathBuf::from("WEAVIA"));
    }
}
