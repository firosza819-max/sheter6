export function formatCurrency(value, currencyCode = 'EGP') {
  const num = Number(value) || 0;

  // خريطة الرموز العربية للعملات
  const currencySymbols = {
    EGP: 'ج.م',
    USD: '$',
    EUR: '€',
    SAR: 'ر.س',
    AED: 'د.إ',
  };

  const symbol = currencySymbols[currencyCode] || currencyCode;

  const formattedNum = new Intl.NumberFormat('ar-EG', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  return `${formattedNum} ${symbol}`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat('ar-EG').format(Number(value) || 0);
}

export function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatDateShort(value) {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}
