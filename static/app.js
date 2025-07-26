const API = '/api';
let currentPath = '';

/* ---------- 调试 ---------- */
const DEBUG_ENABLED = true;
const log = (...args) => {
  if (!DEBUG_ENABLED) return;      // 关闭状态直接返回
  console.log('[App_DEBUG]', ...args);      // 打开状态才打印
};


/* ---------- 工具 ---------- */
const qs = sel => document.querySelector(sel);
const qsa = sela => document.querySelectorAll(sela);

function esc(p) {
  const encoded = encodeURIComponent(p);
  return encoded;
}

async function api(url, opts = {}) {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return json;
  } catch (e) {
    console.error('网络错误', e);
    throw e;
  }
}

/* ---------- 盘符 ---------- */
async function loadDrives() {
  const drives = await api(`${API}/drives`);
  const box = qs('#drive-list');
  box.innerHTML = '';
  drives.forEach(d => {
    const a = document.createElement('a');
    a.className = 'list-group-item list-group-item-action';
    a.textContent = a.title = d;
    a.href = '#';
    a.onclick = () => {
      changeDir(d);
    };
    box.appendChild(a);
  });
}

/* ---------- 面包屑 ---------- */
function renderBreadcrumb(fullPath) {
  const bc = document.getElementById('breadcrumb');
  bc.innerHTML = '';
  if (!fullPath) {
    bc.innerHTML = '<li class="breadcrumb-item active">根目录</li>';
    return;
  }
  const parts = fullPath.split('\\');
  let acc = '';
  parts.forEach((p, idx) => {
    acc += (idx === 0 ? '' : '\\') + p;
    const li = document.createElement('li');
    li.className = 'breadcrumb-item';
    const text = idx === parts.length - 1 ? p : (p || parts[0]);
    if (idx === parts.length - 1) {
      li.classList.add('active');
      li.textContent = text;
    } else {
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = text;
      // 使用立即执行函数创建独立作用域
      (currentliPath => {
        a.onclick = () => {
          log('点击', currentliPath);
          changeDir(currentliPath);
        };
      })(acc);
      li.appendChild(a);
    }
    bc.appendChild(li);
  });
}

/* ---------- 文件列表 ---------- */
async function refreshList() {
  try {
    const url = `${API}/browse?path=${esc(currentPath)}`;
    const items = await api(url);
    const box = qs('#file-list');
    box.innerHTML = '';
    if (!items.length) {
      box.innerHTML = '<div class="text-center p-4 text-muted">空文件夹</div>';
      return;
    }
    items.forEach(it => {
      const row = document.createElement('div');
      row.className = 'list-group-item d-flex justify-content-between align-items-center';
      const icon = it.isDir ? 'fa-folder' : 'fa-file';
      const size = it.isDir ? '' : `(${formatSize(it.size)})`;
      
      // 使用dataset存储路径信息
      row.innerHTML = `
        <div>
          <i class="fa ${icon} me-2"></i>
          <a href="#" class="item-link" data-path="${it.path}" data-isdir="${it.isDir}">
            ${it.name} ${size}
          </a>
        </div>
        ${!it.isDir ? `
          <div>
            <button class="btn btn-sm btn-outline-success download-btn" data-path="${it.path}">
              <i class="fa fa-download"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger delete-btn" data-path="${it.path}">
              <i class="fa fa-trash"></i>
            </button>
          </div>` : ''}
      `;
      box.appendChild(row);
    });
    
    qs('#current-title').textContent = currentPath || '根目录';
  } catch (e) {
    console.error('刷新列表失败', e);
  }
}

/* ---------- 功能 ---------- */
function changeDir(path) {
  currentPath = path;   // 原样保存
  renderBreadcrumb(currentPath);
  refreshList();
  log('切换目录:', currentPath);
}

function handleItem(path, isDir) {
  isDir ? changeDir(path) : downloadFile(path);
}

function downloadFile(path) {
  location.href = `${API}/download?path=${esc(path)}`;
}

async function deleteItem(path) {
  if (!confirm('确定删除 ' + path + ' 吗？')) return;
  try {
    await api('/api/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    refreshList();
  } catch (e) {
    console.error('删除失败', e);
  }
}

function formatSize(b) {
  return b < 1024 ? b + ' B' :
         b < 1024 ** 2 ? (b / 1024).toFixed(1) + ' KB' :
         (b / 1024 ** 2).toFixed(1) + ' MB';
}

/* ---------- 拖拽上传 ---------- */
(function initUpload() {
  const dropzone = qs('#dropzone');
  const fileInput = qs('#file-input');
  const progress = qs('.progress');
  const bar = progress.querySelector('.progress-bar');

  dropzone.onclick = () => fileInput.click();
  dropzone.ondragover = e => { e.preventDefault(); dropzone.classList.add('dragover'); };
  dropzone.ondragleave = () => dropzone.classList.remove('dragover');
  dropzone.ondrop = e => { e.preventDefault(); dropzone.classList.remove('dragover'); uploadFiles(e.dataTransfer.files); };
  fileInput.onchange = () => uploadFiles(fileInput.files);

  async function uploadFiles(files) {
    if (!files.length) return;
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    progress.style.display = 'block';
    bar.style.width = '0%';
    try {
      await fetch(`${API}/upload?path=${esc(currentPath)}`, { method: 'POST', body: fd });
      bar.style.width = '100%';
      setTimeout(() => progress.style.display = 'none', 500);
      refreshList();
    } catch (e) {
      console.error('上传失败', e);
      progress.style.display = 'none';
    }
  }
})();

/* ---------- 事件监听器注册 ---------- */
(function initEventListeners() {
  qs('#file-list').addEventListener('click', function(e) {
    // 处理文件/文件夹点击
    if (e.target.closest('.item-link')) {
      const link = e.target.closest('.item-link');
      handleItem(link.dataset.path, link.dataset.isdir);
      e.preventDefault();
    }
    
    // 处理下载按钮
    if (e.target.closest('.download-btn')) {
      const btn = e.target.closest('.download-btn');
      downloadFile(btn.dataset.path);
      e.preventDefault();
    }
    
    // 处理删除按钮
    if (e.target.closest('.delete-btn')) {
      const btn = e.target.closest('.delete-btn');
      deleteItem(btn.dataset.path);
      e.preventDefault();
    }
  });
})();

/* ---------- 启动 ---------- */
console.clear();
loadDrives();
changeDir('');