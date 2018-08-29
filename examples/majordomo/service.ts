import {Router} from "zeromq-ng"

import {Header, Message} from "./types"

export class Service {
  name: string
  socket: Router
  workers: Map<string, Buffer> = new Map
  requests: [Buffer, Buffer[]][] = []

  constructor(socket: Router, name: string) {
    this.socket = socket
    this.name = name
  }

  async dispatchRequest(client: Buffer, ...req: Buffer[]) {
    this.requests.push([client, req])
    await this.dispatchPending()
  }

  async dispatchReply(worker: Buffer, client: Buffer, ...rep: Buffer[]) {
    this.workers.set(worker.toString('hex'), worker)

    console.log(
      `dispatching '${this.name}' ` +
      `${client.toString('hex')} <- rep ${worker.toString('hex')}`
    )

    await this.socket.send([
      client,
      null,
      Header.Client,
      this.name,
      ...rep,
    ])

    await this.dispatchPending()
  }

  async dispatchPending() {
    while (this.workers.size && this.requests.length) {
      const [key, worker] = this.workers.entries().next().value!
      this.workers.delete(key)
      const [client, req] = this.requests.shift()!

      console.log(
        `dispatching '${this.name}' ` +
        `${client.toString('hex')} req -> ${worker.toString('hex')}`
      )

      await this.socket.send([
        worker,
        null,
        Header.Worker,
        Message.Request,
        client,
        null,
        ...req,
      ])
    }
  }

  async register(worker: Buffer) {
    console.log(`registered worker ${worker.toString('hex')} for '${this.name}'`)
    this.workers.set(worker.toString('hex'), worker)
    await this.dispatchPending()
  }

  async deregister(worker: Buffer) {
    console.log(`deregistered worker ${worker.toString('hex')} for '${this.name}'`)
    this.workers.delete(worker.toString('hex'))
    await this.dispatchPending()
  }
}