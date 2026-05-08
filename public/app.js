document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const uploadForm = document.getElementById('uploadForm');
  const submitBtn = document.getElementById('submitBtn');
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const resultsCard = document.getElementById('resultsCard');

  fetch('/api/files')
    .then(res => res.json())
    .then(files => {
      if (files && Array.isArray(files)) {
        files.forEach(fileData => displayResults(fileData));
      }
    })
    .catch(console.error);

  dropZone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length) {
      fileInput.files = files;
      updateDropZoneText(files);
      submitBtn.disabled = false;
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (fileInput.files.length) {
      updateDropZoneText(fileInput.files);
      submitBtn.disabled = false;
    }
  });

  function updateDropZoneText(files) {
    const textSpan = dropZone.querySelector('.upload-text');
    if (files.length === 1) {
      textSpan.innerHTML = `Selected: <span class="highlight">${files[0].name}</span>`;
    } else {
      textSpan.innerHTML = `Selected: <span class="highlight">${files.length} files</span>`;
    }
  }

  uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!fileInput.files.length) return;

    const MAX_SIZE_MB = 50;
    const formData = new FormData();
    for (let i = 0; i < fileInput.files.length; i++) {
      const file = fileInput.files[i];

      // Frontend validation: stop upload if file is too big
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        alert(`Файлът "${file.name}" е твърде голям! Максималният размер е ${MAX_SIZE_MB}MB.`);
        return;
      }

      formData.append('documents', file);
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';
    progressContainer.classList.remove('hidden');
    const resultsContainer = document.getElementById('resultsContainer');
    // resultsContainer.innerHTML = ''; // Premaxvame iztrivaneto na starite failove
    progressBar.style.width = '0%';

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        progressBar.style.width = percentComplete + '%';
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);

        if (response.results && Array.isArray(response.results)) {
          response.results.forEach(fileData => displayResults(fileData));
        }
      } else {
        alert('Upload failed: ' + xhr.responseText);
      }
      resetUI();
    });

    xhr.addEventListener('error', () => {
      alert('Upload failed due to network error.');
      resetUI();
    });

    xhr.open('POST', '/api/upload', true);
    xhr.send(formData);
  });

  function displayResults(data) {
    const template = document.getElementById('resultCardTemplate');
    const clone = template.content.cloneNode(true);

    clone.querySelector('h2').textContent = data.originalName;
    const serverFileName = data.savedAs.split('/').pop();
    clone.querySelector('.resName').textContent = serverFileName;
    clone.querySelector('.resSize').textContent = formatBytes(data.sizeBytes);
    clone.querySelector('.resCompSize').textContent = formatBytes(data.compressedSize);
    clone.querySelector('.resLines').textContent = data.lineCount.toLocaleString();
    clone.querySelector('.resHash').textContent = data.md5Hash;

    const downloadBtn = clone.querySelector('.download-btn');
    const compressedFileName = data.savedAs + '.gz';

    downloadBtn.href = `/api/download/${compressedFileName}?originalName=${encodeURIComponent(data.originalName)}`;

    downloadBtn.download = data.originalName + '.gz';

    const resultsContainer = document.getElementById('resultsContainer');

    resultsContainer.appendChild(clone);
  }

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function resetUI() {
    submitBtn.textContent = 'Upload Files';
    submitBtn.disabled = false;
    setTimeout(() => {
      progressContainer.classList.add('hidden');
    }, 1000);
  }
});
