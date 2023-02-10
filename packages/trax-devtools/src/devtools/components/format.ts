
export function formatDuration(ms: number) {
    const ds = 1000;
    const dmin = 60 * ds;
    const dhour = 60 * dmin;

    if (ms < 1000) {
        return ms + "ms";
    }
    let s = ms / 1000;
    if (s < 60) {
        return (Math.ceil(s * 10) / 10) + "s";
    }
    let min = ms / dmin;
    if (min < 60) {
        min = Math.floor(min);
        s = Math.floor((ms - min * dmin) / ds);
        return `${min}min ${s}s`;
    }

    let hour = ms / dhour;
    if (hour < 24) {
        hour = Math.floor(hour);
        min = Math.floor((ms - hour * dhour) / dmin);
        return `${hour}h ${min}min`;
    }

    return ">1 day";
}