import {ComponentPreview, Previews} from "@react-buddy/ide-toolbox";
import {PaletteTree} from "./palette";
import App from "../App.tsx";
import {HighestPriorityTaskBox} from "../components/HighestPriorityTaskBox.tsx";

const ComponentPreviews = () => {
    return (
        <Previews palette={<PaletteTree/>}>
            <ComponentPreview path="/App">
                <App/>
            </ComponentPreview>
            <ComponentPreview
                path="/HighestPriorityTaskBox">
                <HighestPriorityTaskBox/>
            </ComponentPreview>
        </Previews>
    );
};

export default ComponentPreviews;