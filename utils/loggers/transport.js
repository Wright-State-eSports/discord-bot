import pino from 'pino';

/**
 * Create a transport object to use for pino
 *
 * The function creates 1 destination that is given by the caller
 * and 2 more that will be combined
 *
 * @param {string} destination The target destination that differs from other
 */
export default function createTransport(destination) {
    // The file transport
    const transport = pino.transport({
        targets: [
            {
                target: 'pino-pretty',
                options: { destination: `${process.cwd()}/logs/${destination}.log`, colorize: false }
            },

            // Targets the combined logs file
            {
                target: 'pino-pretty',
                options: { destination: `${process.cwd()}/logs/combined.log`, colorize: false }
            },

            // Targets the console, with formatting
            {
                target: 'pino-pretty'
            }
        ]
    });

    return transport;
}
