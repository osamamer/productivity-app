/** "Good morning, Sam." — shared by the labor and leisure home views. */
export function homeGreeting(hour: number, firstName: string): string {
    const greeting = hour < 5 ? 'Good wee hours' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return `${greeting}${firstName ? `, ${firstName}` : ''}.`;
}
