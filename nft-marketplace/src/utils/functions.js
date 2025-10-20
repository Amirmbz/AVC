export function startCountdown(targetDateTime, callback) {
  let targetDate = new Date(targetDateTime);

  if (!targetDateTime.includes("T") && !/\d{1,2}:\d{2}/.test(targetDateTime)) {
    targetDate.setHours(0, 0, 0, 0);
  }

  const timer = setInterval(() => {
    const now = new Date().getTime();
    const distance = targetDate.getTime() - now;

    if (distance < 0) {
      clearInterval(timer);
      callback({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        expired: true,
      });
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    callback({
      days,
      hours,
      minutes,
      seconds,
      expired: false,
    });
  }, 1000);

  return timer;
}