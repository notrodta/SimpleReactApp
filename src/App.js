import React from 'react';
import './App.css';

class Hello extends React.Component {
  constructor(props) {
    super(props);
    this.state = { lastName: "Ta" };
  }

  render() {
    return <h1> Hello, {this.props.name} {this.state.lastName}</h1>
  }
};

class IncrementButton extends React.Component{
  constructor(props) {
    super(props);
    this.state = {
      val: 0
    };
    this.handleClick = this.handleClick.bind(this);
  }
  
  handleClick() {
    this.setState({
      val: this.state.val + 1
    });
  }

  render() {
    return (
      <div className="IncButton">
        <button onClick={this.handleClick}> {this.state.val}  </button>
      </div>
    );
  }
};

class ChangeTextButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      text: "text1",
      text1: "text1",
      text2: "text2",
      toggle: true
    };
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    this.setState(state => ({
      toggle: !state.toggle,
      text: state.toggle ? state.text2 : state.text1
    }));
  }

  render() {
    return (
      <div>
        <button onClick={this.handleClick}> {this.state.text} </button>
      </div>  
    );
  }
};

const Bye = props => (
   <h1> Goodbye, {props.firstName} {props.lastName} </h1>
);

const PressMeButton = () => (
  <button> I do nothing </button>  
);

const HelloAgain = props => {
  return <h1> Hello Again, {props.firstName} {props.lastName} </h1>
}


function App() {
  return (
    <div className="App">    
      <Hello name="Rod" />
      <Bye firstName="Rod" lastName="Ta" />
      <HelloAgain firstName="Rod" lastName="Ta" />
      <PressMeButton />
      <IncrementButton />
      <ChangeTextButton />
    </div>
  );
}

export default App;
