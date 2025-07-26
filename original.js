function renderBreadcrumb(fullPath) {
    const bc = $('#breadcrumb');
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
        a.onclick = () => {
          log('点击', acc);
          changeDir(acc);
        };
        li.appendChild(a);
      }
      bc.appendChild(li);
    });
  }