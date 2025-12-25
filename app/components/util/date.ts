export function formatDate(dateString: string) {
  if (dateString.startsWith("1970")) {
    return "-";
  }

  if (!dateString || dateString.length < "2025-01-01 01:01:01".length) {
    return dateString ?? "";
  }
  // 获取当前日期
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 月份从 0 开始，需要加 1
  const currentDay = currentDate.getDate();

  // 解析输入的日期字符串
  const inputDate = new Date(dateString);
  const inputYear = inputDate.getFullYear();
  const inputMonth = inputDate.getMonth() + 1;
  const inputDay = inputDate.getDate();
  const inputTime = dateString.split(" ")[1]; // 提取时间部分

  let result = "";

  if (inputYear !== currentYear) {
    return dateString;
  }
  // 是今年，去掉年份
  result = `${inputMonth}-${inputDay} ${inputTime}`;
  if (inputMonth === currentMonth && inputDay === currentDay) {
    result = `Today ${inputTime}`;
  }
  return result;
}
