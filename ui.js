export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function radios(name, options, selected) {
  return `<div class="choices">${options.map(option => `<label class="choice"><input type="radio" name="${esc(name)}" value="${esc(option.value)}" ${option.value === selected ? 'checked' : ''}><span>${esc(option.label)}</span></label>`).join('')}</div>`;
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function seniorityLabel(value) {
  if (!value) return 'Seniority not stated in the ad';
  return `Seniority in the ad: ${value}`;
}
