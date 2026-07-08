// Downloads a report via authenticated fetch (Blob) so the JWT header is sent.
export async function downloadFile(path: string, filename: string) {
  const token = localStorage.getItem('fleet_token');
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
