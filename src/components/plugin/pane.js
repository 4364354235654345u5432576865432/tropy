'use strict'

const React = require('react')
const { ipcRenderer: ipc } = require('electron')
const { WindowContext } = require('../main')
const { PrefPane } = require('../prefs/pane')
const { Button } = require('../button')
const { bool, func, string } = require('prop-types')
const { AccordionGroup } = require('../accordion')
const { PluginAccordion } = require('./accordion')
const { values } = Object
const debounce = require('lodash.debounce')
const { insert, omit, splice } = require('../../common/util')


class PluginsPane extends React.Component {
  state = { config: [] }

  componentDidMount() {
    // Subtle: we assume `plugins` is a Singleton, therefore
    // it's safe to manage the listeneres in mount/unmount!
    this.context.plugins.on('change', this.refresh)
    this.refresh()
  }

  componentWillUnmount() {
    this.persist.flush()
    this.context.plugins.removeListener('change', this.refresh)
  }

  refresh = () => {
    this.setState({
      config: this.context.plugins.config.map(config => ({ ...config }))
    })
  }

  persist = debounce(() => {
    this.context.plugins.store(this.state.config)
  }, 500)

  handleUninstall = (name) => {
    this.props.onUninstall({ name, plugins: this.context.plugins })
  }

  handleChange = (plugin, changes) => {
    let { config } = this.state
    let idx = config.indexOf(plugin)
    this.setState({
      config: splice(config, idx, 1, { ...plugin, ...changes })
    }, this.persist)
  }

  handleInsert = (name, after = null) => {
    this.setState({
      config: insert(
        this.state.config,
        this.state.config.indexOf(after) + 1,
        { plugin: name, options: {} })
    }, this.persist)
  }

  handleRemove = (plugin) => {
    this.setState({
      config: this.state.config.filter(c => c !== plugin)
    }, this.persist)
  }

  handleDisable = (name) => {
    this.setState({
      config: this.state.config.map(cfg =>
        (cfg.plugin !== name) ? cfg : { ...cfg, disabled: true })
    }, this.persist)
  }

  handleEnable = (name) => {
    let k = 0
    let config = this.state.config.map(cfg =>
        (cfg.plugin !== name) ? cfg : (++k, omit(cfg, ['disabled'])))

    if (k === 0) return this.handleInsert(name)
    this.setState({ config }, this.persist)
  }

  handleInstall() {
    ipc.send('cmd', 'app:install-plugin')
  }

  getPluginInstances(name) {
    return this.state.config.filter(c => c.plugin === name && !c.disabled)
  }

  render() {
    return (
      <PrefPane
        name={this.props.name}
        isActive={this.props.isActive}>
        <div className="scroll-container">
          <AccordionGroup
            autoclose
            className="form-horizontal"
            tabIndex={0}>
            {values(this.context.plugins.spec).map(
               (spec) => {
                 return (
                   <PluginAccordion
                     id={spec.name}
                     instances={this.getPluginInstances(spec.name)}
                     spec={spec}
                     onChange={this.handleChange}
                     onDisable={this.handleDisable}
                     onEnable={this.handleEnable}
                     onInsert={this.handleInsert}
                     onRemove={this.handleRemove}
                     onUninstall={this.handleUninstall}
                     onOpenLink={this.props.onOpenLink}
                     key={spec.name}/>)
               })
            }
          </AccordionGroup>
        </div>
        <footer className="plugins-footer">
          <Button
            isDefault
            text="prefs.plugins.install"
            onClick={this.handleInstall}/>
        </footer>
      </PrefPane>
    )
  }

  static propTypes = {
    isActive: bool,
    name: string.isRequired,
    onUninstall: func.isRequired,
    onOpenLink: func.isRequired
  }

  static contextType = WindowContext
}

module.exports = {
  PluginsPane
}
