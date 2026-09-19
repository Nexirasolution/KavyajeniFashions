'use client';

import { useState } from 'react';

export default function UploadForm({ folder = 'uploads', onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setUrl(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder); // change per use case, e.g. 'avatars'

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }

      const data = await res.json();
      setUrl(data.url);
      onUploaded?.(data.url, data.key);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      // allow re-selecting the same file
      e.target.value = '';
    }
  }

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} />

      {uploading && <p>Uploading &amp; optimizing…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {url && (
        <div>
          <p>Uploaded successfully (resized + converted to WebP):</p>
          <a href={url} target="_blank" rel="noreferrer">{url}</a>
        </div>
      )}
    </div>
  );
}