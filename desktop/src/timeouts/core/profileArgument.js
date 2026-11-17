const PROFILE_FLAG = '--profile';

/**
 * The profile an argv asks for (`--profile name` or `--profile=name`), or null. Apps such as
 * Nuclear run light profiles from the same binary; the profile tells their processes apart so
 * each profile can have its own pause and auto-close.
 */
function profileArgument(argv) {
    for (let index = 0; index < argv.length; index += 1) {
        const word = argv[index];
        if (word === '--') return null;
        if (word === PROFILE_FLAG) return argv[index + 1] || null;
        if (word.startsWith(`${PROFILE_FLAG}=`)) return word.slice(PROFILE_FLAG.length + 1) || null;
    }
    return null;
}

module.exports = { profileArgument };
