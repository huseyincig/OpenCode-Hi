export class BrowserRuntime {
    executor;
    constructor(executor) {
        this.executor = executor;
    }
    health() { return this.executor.health(); }
    open(c, url) { return this.executor.open(c, url); }
    navigate(c, url) { return this.executor.navigate(c, url); }
    click(c, target) { return this.executor.click(c, target); }
    type(c, target, value) { return this.executor.type(c, target, value); }
    inspect(c, request) { return this.executor.inspect(c, request); }
    screenshot(c) { return this.executor.screenshot(c); }
    wait(c, request) { return this.executor.wait(c, request); }
    close(c) { return this.executor.close(c); }
    async dispose() { const x = this.executor; if (x.dispose)
        await x.dispose(); }
}
