// Shared tsc error-line parser so verify and the on-edit guard report type failures the same way:
// `ts/TS<code>: file:line message` from `tsc --noEmit --pretty false`.

export const TS_LINE = /^(?<rel>.+?)\((?<line>\d+),(?<col>\d+)\):\s*error\s+TS(?<code>\d+):\s*(?<message>.+)$/;