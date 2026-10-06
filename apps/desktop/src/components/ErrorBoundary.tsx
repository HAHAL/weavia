import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@weavia/ui';
export class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true}}componentDidCatch(error:Error,info:ErrorInfo){console.error('WEAVIA UI error',error.name,info.componentStack)}render(){if(this.state.failed)return <main className="fatal"><h1>页面出现问题</h1><p>你的本地项目没有受到影响。请重新加载应用。</p><Button onClick={()=>window.location.reload()}>重新加载</Button></main>;return this.props.children}}
