/**
 * Logger function that only prints messages in development environment
 * @param args - Arguments to log, same as console.log
 */
export const devLog = (...args: any[]): void => {
    if (process.env.NODE_ENV === 'development') {
        console.log('[DEV]:', ...args);
    }
};

/**
 * Debug logger function that only prints messages in development environment
 * Similar to devLog but with a DEBUG prefix
 * @param args - Arguments to log, same as console.log
 */
export const devDebug = (...args: any[]): void => {
    if (process.env.NODE_ENV === 'development') {
        console.debug('[DEV DEBUG]:', ...args);
    }
};

/**
 * Error logger function that only prints messages in development environment
 * @param args - Arguments to log, same as console.error
 */
export const devError = (...args: any[]): void => {
    if (process.env.NODE_ENV === 'development') {
        console.error('[DEV ERROR]:', ...args);
    }
};
export default {
    devLog,
    devDebug,
    devError,
};  