import client from 'prom-client'

class MetricsService{

    private register: client.Registry;
    public httpRequestDuration: client.Histogram<string>;

    constructor(){
        this.register = new client.Registry();
        
        client.collectDefaultMetrics({register: this.register});

        this.httpRequestDuration = new client.Histogram({
            name: 'http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'statusCode'],
            buckets: [0.1, 0.3, 0.5, 1, 1.5, 2],
    })

    this.register.registerMetric(this.httpRequestDuration)
    }

    public async metrics() {
    return this.register.metrics();
  }

  public getRegistry() {
    return this.register;
  }
}


export const metricsService = new MetricsService();