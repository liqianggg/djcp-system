import React from 'react';
import { hasPermission } from './api';

// 按钮级权限控制：有权限显示，无权限隐藏
export function PermBtn({ perm, children, ...props }) {
  if (!hasPermission(perm)) return null;
  // Clone children or wrap in button
  if (typeof children === 'string') {
    return <button {...props}>{children}</button>;
  }
  return React.cloneElement(React.Children.only(children), props);
}

// 容器级权限控制
export function Can({ perm, children }) {
  if (!hasPermission(perm)) return null;
  return <>{children}</>;
}

// 无权限时显示禁用状态
export function PermBtnDisabled({ perm, children, ...props }) {
  const allowed = hasPermission(perm);
  if (typeof children === 'string') {
    return <button {...props} disabled={!allowed} style={{...props.style, opacity: allowed ? 1 : 0.5}} title={allowed ? '' : '权限不足'}>{children}</button>;
  }
  const child = React.Children.only(children);
  return React.cloneElement(child, { ...props, disabled: !allowed, style: {...child.props.style, opacity: allowed ? 1 : 0.5}, title: allowed ? child.props.title : '权限不足' });
}
