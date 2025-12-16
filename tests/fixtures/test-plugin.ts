import type { Plugin } from '@lesca/shared/types'

class TestPlugin implements Plugin {
  name = 'test-plugin'
  version = '1.0.0'

  async onInit() {}
  async onCleanup() {}
}

export default new TestPlugin()
