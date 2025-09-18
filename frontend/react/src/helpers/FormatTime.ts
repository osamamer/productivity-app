const formatTime = (dateTime: string): string => {
    const formatted: Date = new Date(dateTime);
    const today: Date = new Date();
    if (today.getUTCDay() == formatted.getUTCDay()) {
        return "Today";
    }
    return formatted;
}