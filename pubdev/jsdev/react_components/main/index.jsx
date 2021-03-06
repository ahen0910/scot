'use strict';
var ReactDOM	    = require('react-dom')
var React           = require('react')
var Navbar          = require('react-bootstrap/lib/Navbar.js');
var Nav             = require('react-bootstrap/lib/Nav.js');
var NavItem         = require('react-bootstrap/lib/NavItem.js');
var NavDropdown     = require('react-bootstrap/lib/NavDropdown.js');
var MenuItem        = require('react-bootstrap/lib/MenuItem.js');
var LinkContainer   = require('react-router-bootstrap/lib/LinkContainer.js');
var ListView        = require('../list/list-view.jsx');
var Router	        = require('react-router-dom').Router
var Route	        = require('react-router-dom').Route
var Link	        = require('react-router-dom').Link
var customHistory   = require('history').createBrowserHistory
var Switch          = require('react-router-dom').Switch;
var HashRouter      = require('react-router-dom').HashRouter;
var BrowserRouter   = require('react-router-dom').BrowserRouter;
var Listener        = require('../activemq/listener.jsx')
var Store           = require('../activemq/store.jsx');
var SelectedContainer = require('../detail/selected_container.jsx')
var EntityDetail      = require('../modal/entity_detail.jsx')
var AMQ             = require('../debug-components/amq.jsx');
var Wall            = require('../debug-components/wall.jsx');
var Search          = require('../components/esearch.jsx');
var Revl            = require('../components/visualization/revl.coffee');
var Gamification    = require('../components/dashboard/gamification.jsx');
var Status          = require('../components/dashboard/status.jsx');
var Online          = require('../components/dashboard/online.jsx');
var Report          = require('../components/dashboard/report.jsx');
var Notification    = require('react-notification-system');
var isalert = false
{
	window.React = React;	
	var $ = window.$;

}

var App = React.createClass({

    getInitialState: function(){
        Listener.activeMq();   //register for amq updates
        return{handler: "Scot", viewMode:'default', notificationSetting: 'on', eestring: ''}	
    },
    componentDidMount: function() {
	    $.ajax({
	        type: 'get',
	        url: '/scot/api/v2/handler?current=1'
	    }).success(function(response){
	        this.setState({handler: response.records[0].username})
	    }.bind(this))
        Store.storeKey('wall');
        Store.addChangeListener(this.wall);
        Store.storeKey('notification');
        Store.addChangeListener(this.notification);
       
        //ee
        if (this.props.match.params.value == '') {
            $(document.body).keydown(function(e) {
                this.ee(e);
            }.bind(this))   
        }
    },
    componentWillReceiveProps: function (nextProps) {
        var viewModeSetting = checkCookie('viewMode');
        var notificationSetting = checkCookie('notification');
        if (nextProps.match.params.value) {
            var listViewFilterSetting = checkCookie('listViewFilter'+nextProps.match.params.value.toLowerCase());
            var listViewSortSetting = checkCookie('listViewSort'+nextProps.match.params.value.toLowerCase());
            var listViewPageSetting = checkCookie('listViewPage'+nextProps.match.params.value.toLowerCase());
        }
        if (notificationSetting == undefined) {
            notificationSetting = 'on';
        }
        this.setState({viewMode:viewModeSetting, notificationSetting:notificationSetting, listViewFilter:listViewFilterSetting,listViewSort:listViewSortSetting, listViewPage:listViewPageSetting})
    },
    ee: function(e) {
        var ee = '837279877769847269697171';
        if (ee.includes(this.state.eestring)) {
            if (this.state.eestring + e.keyCode == ee) {
                this.eedraw();
                setTimeout(this.eeremove,2000);    
            } else {
                if ($('input').is(':focus')) {return};
                if (e.ctrlKey != true && e.metaKey != true) {
                    var eestring = this.state.eestring + e.keyCode;
                    this.setState({eestring: eestring});
                }
            }
        } else {
            this.setState({eestring: ''});
        }
    },
    eedraw: function() {
        $('#content').css('transform','rotateX(20deg)');
        $(document.body).prepend('<span id="ee">Lbh sbhaq gur egg. Cbfg gb gur jnyy "V sbhaq gur rtt, pna lbh?"</span>');
    },
    eeremove: function() {
        $('#content').css('transform','rotateX(0deg)');
        $('#ee').remove();
    },
    componentWillMount: function() {
        //Get landscape/portrait view if the cookie exists
        var viewModeSetting = checkCookie('viewMode');
        var notificationSetting = checkCookie('notification');
        if (this.props.match.params.value) {
            var listViewFilterSetting = checkCookie('listViewFilter'+this.props.match.params.value.toLowerCase());
            var listViewSortSetting = checkCookie('listViewSort'+this.props.match.params.value.toLowerCase());
            var listViewPageSetting = checkCookie('listViewPage'+this.props.match.params.value.toLowerCase());
        }
        if (notificationSetting == undefined) {
            notificationSetting = 'on';
        }
        this.setState({viewMode:viewModeSetting, notificationSetting:notificationSetting, listViewFilter:listViewFilterSetting,listViewSort:listViewSortSetting, listViewPage:listViewPageSetting})
    },
    notification: function() {
        //Notification display in update as it will run on every amq message matching 'main'.
        var notification = this.refs.notificationSystem
        //not showing notificaiton on entity due to "flooding" on an entry update that has many entities causing a storm of AMQ messages
        if(activemqwho != 'scot-alerts' && activemqwho != 'scot-admin' && activemqwho!= 'scot-flair' && notification != undefined && activemqwho != "" &&  activemqwho != 'api' && activemqwall != true && activemqtype != 'entity' && this.state.notificationSetting == 'on'){  
            notification.addNotification({
                message: activemqwho + activemqmessage + activemqid,
                level: 'info',
                autoDismiss: 5,
                action: activemqstate != 'delete' ? {
                    label: 'View',
                    callback: function(){
                        if(activemqtype == 'entry' || activemqtype == 'alert'){
                            activemqid = activemqsetentry
                            activemqtype = activemqsetentrytype
                        }
                        window.open('/#/' + activemqtype + '/' + activemqid)
                    }
                } : null
            })
        }
    },
    wall: function() {
        var notification = this.refs.notificationSystem
        var date = new Date(activemqwhen * 1000);
        date = date.toLocaleString();
        if (activemqwall == true) {
            notification.addNotification({
                message: date + ' ' + activemqwho + ': ' + activemqmessage,
                level: 'warning',
                autoDismiss: 0,
            })
            activemqwall = false;
        }
    },
    errorToggle: function(string) {
        var notification = this.refs.notificationSystem
        notification.addNotification({
            message: string,
            level: 'error',
            autoDismiss: 0,
        });
    },
    notificationToggle: function() {
        if(this.state.notificationSetting == 'off'){
            this.setState({notificationSetting: 'on'})
            setCookie('notification','on',1000);
        }
        else {
            this.setState({notificationSetting: 'off'})
            setCookie('notification','off',1000);
        } 
    },
   render: function() {
        var IH = 'Incident Handler: ' + this.state.handler;
        return (
            <div>
                <Navbar inverse fixedTop={true} fluid={true}>
                    <Navbar.Header>
                        <Navbar.Brand>
                            <Link to='/' style={{margin:'0', padding:'0'}}><img src='/images/scot.png' style={{width:'50px'}} /></Link>
                        </Navbar.Brand>
                        <Navbar.Toggle />
                    </Navbar.Header>
                    <Navbar.Collapse>
                        <Nav>
                            <LinkContainer to='/alertgroup' activeClassName='active'>
                                <NavItem>Alert</NavItem>
                            </LinkContainer>
                            <LinkContainer to='/event' activeClassName='active'>
                                <NavItem>Event</NavItem>
                            </LinkContainer>
                            <LinkContainer to='/incident' activeClassName='active'>
                                <NavItem>Incident</NavItem>
                            </LinkContainer>
                            <LinkContainer to='/intel' activeClassName='active'>
                                <NavItem>Intel</NavItem>
                            </LinkContainer>
                            <NavDropdown id='nav-dropdown' title={'More'}>
                                <LinkContainer to='/task' activeClassName='active'>
                                    <MenuItem>Task</MenuItem>
                                </LinkContainer>
                                <LinkContainer to='/guide' activeClassName='active'>
                                    <MenuItem>Guide</MenuItem>
                                </LinkContainer>
                                <MenuItem href='/revl.html/#/visualization'>Visualization</MenuItem>
                                <LinkContainer to='/signature' activeClassName='active'>
                                    <MenuItem>Signature</MenuItem>
                                </LinkContainer>
                                <LinkContainer to='/entity' activeClassName='active'>
                                    <MenuItem>Entity</MenuItem>
                                </LinkContainer>
                                <LinkContainer to='/report' activeClassName='active'>
                                    <MenuItem>Report</MenuItem>
                                </LinkContainer>
                                <MenuItem divider />
                                <MenuItem href='/admin/index.html'>Administration</MenuItem>
                                <MenuItem href='/docs/index.html'>Documentation</MenuItem>
                            </NavDropdown>
                            <NavItem href='/incident_handler.html'>{IH}</NavItem>
                        </Nav>
                        <span id='ouo_warning' className='ouo-warning'>{sensitivity}</span>
                        <Search errorToggle={this.errorToggle} />
                    </Navbar.Collapse>
                </Navbar>
                <div className='mainNavPadding'>
                    <Notification ref='notificationSystem' />
                    {!this.props.match.params.value || this.props.match.params.value == 'home' ? 
                    <div className="homePageDisplay">
                        <div className='col-md-4'>
                            <img src='/images/scot-600h.png' style={{maxWidth:'350px',width:'100%',marginLeft:'auto', marginRight:'auto', display: 'block'}}/>
                            <h1>Sandia Cyber Omni Tracker 3.5</h1>
                            <h1>{sensitivity}</h1>
                            <Status />
                        </div>
                        <Gamification />
                        <Online />
                        <Report frontPage={true} />
                    </div>
                    :
                    null}
                    { this.props.match.params.value == 'alert' ? 
                        <ListView id={this.props.match.params.id} id2={this.props.match.params.id2} viewMode={this.state.viewMode} type={this.props.match.params.value} notificationToggle={this.notificationToggle} notificationSetting={this.state.notificationSetting} listViewFilter={this.state.listViewFilter} listViewSort={this.state.listViewSort} listViewPage={this.state.listViewPage} errorToggle={this.errorToggle} history={this.props.history}/>
                    :
                    null}
                    { this.props.match.params.value == 'alertgroup' ? 
                        <ListView id={this.props.match.params.id} id2={this.props.match.params.id2} viewMode={this.state.viewMode} type={this.props.match.params.value} notificationToggle={this.notificationToggle} notificationSetting={this.state.notificationSetting} listViewFilter={this.state.listViewFilter} listViewSort={this.state.listViewSort} listViewPage={this.state.listViewPage} errorToggle={this.errorToggle} history={this.props.history}/>
                    :
                    null}
                    {this.props.match.params.value == 'event' ?
                        <ListView id={this.props.match.params.id} id2={this.props.match.params.id2} viewMode={this.state.viewMode} type={this.props.match.params.value} notificationToggle={this.notificationToggle} notificationSetting={this.state.notificationSetting} listViewFilter={this.state.listViewFilter} listViewSort={this.state.listViewSort} listViewPage={this.state.listViewPage} errorToggle={this.errorToggle} history={this.props.history}/>
                    :
                    null}
                    {this.props.match.params.value == 'incident' ?
                        <ListView id={this.props.match.params.id} id2={this.props.match.params.id2} viewMode={this.state.viewMode} type={this.props.match.params.value} notificationToggle={this.notificationToggle} notificationSetting={this.state.notificationSetting} listViewFilter={this.state.listViewFilter} listViewSort={this.state.listViewSort} listViewPage={this.state.listViewPage} errorToggle={this.errorToggle} history={this.props.history}/>
                    :
                    null} 
                    {this.props.match.params.value == 'task' ?
                        <ListView id={this.props.match.params.id} id2={this.props.match.params.id2} viewMode={this.state.viewMode} type={this.props.match.params.value} notificationToggle={this.notificationToggle} notificationSetting={this.state.notificationSetting} listViewFilter={this.state.listViewFilter} listViewSort={this.state.listViewSort} listViewPage={this.state.listViewPage} errorToggle={this.errorToggle} history={this.props.history}/>
                    :
                    null}
                    {this.props.match.params.value == 'guide' ?
                        <ListView id={this.props.match.params.id} id2={this.props.match.params.id2} viewMode={this.state.viewMode} type={this.props.match.params.value} notificationToggle={this.notificationToggle} notificationSetting={this.state.notificationSetting} listViewFilter={this.state.listViewFilter} listViewSort={this.state.listViewSort} listViewPage={this.state.listViewPage} errorToggle={this.errorToggle} history={this.props.history}/>
                    :
                    null}
                    {this.props.match.params.value == 'intel' ?
                        <ListView id={this.props.match.params.id} id2={this.props.match.params.id2} viewMode={this.state.viewMode} type={this.props.match.params.value} notificationToggle={this.notificationToggle} notificationSetting={this.state.notificationSetting} listViewFilter={this.state.listViewFilter} listViewSort={this.state.listViewSort} listViewPage={this.state.listViewPage} errorToggle={this.errorToggle} history={this.props.history}/>
                    :
                    null}
                    {this.props.match.params.value == 'signature' ?
                        <ListView id={this.props.match.params.id} id2={this.props.match.params.id2} viewMode={this.state.viewMode} type={this.props.match.params.value} notificationToggle={this.notificationToggle} notificationSetting={this.state.notificationSetting} listViewFilter={this.state.listViewFilter} listViewSort={this.state.listViewSort} listViewPage={this.state.listViewPage} errorToggle={this.errorToggle} history={this.props.history}/>
                    :
                    null}
                    {this.props.match.params.value == 'entity' ?
                        <ListView id={this.props.match.params.id} id2={this.props.match.params.id2} viewMode={this.state.viewMode} type={this.props.match.params.value} notificationToggle={this.notificationToggle} notificationSetting={this.state.notificationSetting} listViewFilter={this.state.listViewFilter} listViewSort={this.state.listViewSort} listViewPage={this.state.listViewPage} errorToggle={this.errorToggle} history={this.props.history}/>
                    :
                    null}
                    {this.props.match.params.value == 'visualization' ?
                        <Revl value={this.props.match.params.value} type={this.props.match.params.id} id={this.props.match.params.type} depth={this.props.match.params.typeid} viewMode={this.state.viewMode} Notification={this.state.Notification} />
                    :
                    null}
                    {this.props.match.params.value == 'report' ?
                        <Report id={this.props.match.params.id} id2={this.props.match.params.id2} viewMode={this.state.viewMode} type={this.props.match.params.value} notificationToggle={this.notificationToggle} notificationSetting={this.state.notificationSetting} listViewFilter={this.state.listViewFilter} listViewSort={this.state.listViewSort} listViewPage={this.state.listViewPage} errorToggle={this.errorToggle}/>
                    :
                    null}
                    {this.props.match.params.value == 'amq' ?
                        <AMQ type='amq' />
                    :
                    null}
                    {this.props.match.params.value == 'wall' ?
                        <Wall />
                    :
                    null}
                </div>
            </div>
        )
    },
});

    ReactDOM.render((
        <HashRouter history={customHistory()}>
            <Switch>
                <Route exact path = '/' component = {App} />
                <Route exact path = '/:value' component = {App} />
                <Route exact path = '/:value/:id' component = {App} />
                <Route exact path = '/:value/:id/:id2' component = {App} />
                <Route path = '/:value/:id/:type/:typeid' component = {App} />
            </Switch>
        </HashRouter>
    ), document.getElementById('content'))

