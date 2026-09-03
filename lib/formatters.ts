export const formatCurrency=(value:number)=>`${new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(value)} ريال`;
export const categoryLabel={diploma:"دبلوم","qualifying-course":"دورة تأهيلية","development-course":"دورة تطويرية"} as const;
export const modeLabel={onsite:"حضوري",online:"عن بُعد"} as const;
export const genderLabel={male:"رجال",female:"نساء",both:"رجال ونساء"} as const;
