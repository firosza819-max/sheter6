// قائمة العملات الشاملة للاستخدام في التطبيق
export const CURRENCIES = [
  { code: 'SAR', name: 'ريال سعودي (SAR)', symbol: 'ر.س' },
  { code: 'USD', name: 'دولار أمريكي (USD)', symbol: '$' },
  { code: 'EUR', name: 'يورو (EUR)', symbol: '€' },
  { code: 'EGP', name: 'جنية مصري (EGP)', symbol: 'ج.م' },
  { code: 'AED', name: 'درهم إماراتي (AED)', symbol: 'د.إ' },
  { code: 'KWD', name: 'دينار كويتي (KWD)', symbol: 'د.ك' },
  { code: 'QAR', name: 'ريال قطري (QAR)', symbol: 'ر.ق' },
  { code: 'BHD', name: 'دينار بحريني (BHD)', symbol: 'د.ب' },
  { code: 'OMR', name: 'ريال عماني (OMR)', symbol: 'ر.ع' },
  { code: 'JOD', name: 'دينار أردني (JOD)', symbol: 'د.أ' },
  { code: 'GBP', name: 'جنيه إسترليني (GBP)', symbol: '£' },
  { code: 'TRY', name: 'ليرة تركية (TRY)', symbol: '₺' },
  { code: 'CAD', name: 'دولار كندي (CAD)', symbol: 'C$' },
  { code: 'AUD', name: 'دولار أسترالي (AUD)', symbol: 'A$' },
  { code: 'CHF', name: 'فرنك سويسري (CHF)', symbol: 'CHF' },
  { code: 'CNY', name: 'يوان صيني (CNY)', symbol: '¥' },
  { code: 'JPY', name: 'ين ياباني (JPY)', symbol: '¥' },
  { code: 'INR', name: 'روبية هندية (INR)', symbol: '₹' },
  { code: 'MAD', name: 'درهم مغربي (MAD)', symbol: 'د.م.' },
  { code: 'DZD', name: 'دينار جزائري (DZD)', symbol: 'د.ج' },
  { code: 'TND', name: 'دينار تونسي (TND)', symbol: 'د.ت' },
  { code: 'LYD', name: 'دينار ليبي (LYD)', symbol: 'د.ل' },
  { code: 'SDG', name: 'جنيه سوداني (SDG)', symbol: 'ج.س' },
  { code: 'IQD', name: 'دينار عراقي (IQD)', symbol: 'د.ع' },
  { code: 'SYP', name: 'ليرة سورية (SYP)', symbol: 'ل.س' },
  { code: 'LBP', name: 'ليرة لبنانية (LBP)', symbol: 'ل.ل' },
  { code: 'YER', name: 'ريال يمني (YER)', symbol: 'ر.ي' },
];

export function formatCurrency(value, currencyCode = 'EGP') {
  const num = Number(value) || 0;

  // البحث عن رمز العملة الخاص
  const found = CURRENCIES.find((c) => c.code === currencyCode);
  const symbol = found ? found.symbol : currencyCode;

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
