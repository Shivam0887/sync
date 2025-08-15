import { lazy, type ComponentType } from "react";

const lazyWithPreload = <T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) => {
  let LoadedComponent: T | undefined;
  let factoryPromise: Promise<void> | undefined;

  const LazyComponent = lazy(factory);

  const loadComponent = () =>
    factory().then((module) => {
      LoadedComponent = module.default;
    });

  const Component = () => LoadedComponent || LazyComponent;

  Component.preload = () =>
    factoryPromise || (factoryPromise = loadComponent());

  return Component;
};

export default lazyWithPreload;
