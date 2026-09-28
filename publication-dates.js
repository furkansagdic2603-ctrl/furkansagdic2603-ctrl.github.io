// Add the Umm al-Qura Hijri date beside each dated article, without changing its saved Gregorian date.
const gregorianMonths = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
const gregorianDate = /\b(\d{1,2})\s+(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\s+(\d{4})\b/u;
const hijriFormatter = new Intl.DateTimeFormat('tr-TR-u-ca-islamic-umalqura', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
});

window.publicationDateText = value => {
  const match = gregorianDate.exec(value || '');
  if (!match) return value || '';
  const day = Number(match[1]);
  const month = gregorianMonths.indexOf(match[2].toLocaleLowerCase('tr'));
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return value;
  const parts = Object.fromEntries(hijriFormatter.formatToParts(date).map(part => [part.type, part.value]));
  if (!parts.day || !parts.month || !parts.year) return value;
  const hijri = `${Number(parts.day)} ${parts.month} ${parts.year}`;
  return value.replace(match[0], `${match[0]} (Miladî) · ${hijri} (Hicrî)`);
};

document.querySelectorAll('.entry .eyebrow, .article-head .eyebrow').forEach(element => {
  element.textContent = window.publicationDateText(element.textContent);
});
